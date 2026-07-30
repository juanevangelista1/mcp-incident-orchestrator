import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { Ga4Summary, ga4SummarySchema } from './ga4.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

interface FetchSummaryParams {
	numOfDays: number;
}

// GA4 Data API não tem o teto duro de 10 req/dia do Clarity (cota padrão: 25 mil
// requisições/dia por propriedade) — cache aqui é só para evitar chamadas repetidas à toa
// durante a navegação normal do dashboard, não uma proteção de cota escassa como no Clarity.
const CACHE_TTL_MS = 60 * 60 * 1000;

export class Ga4Service {
	private readonly client: BetaAnalyticsDataClient;
	private readonly propertyId: string;
	// `null` quando não configurado — não existe fallback para "key events" genéricos: o
	// usuário decidiu que só quer contar um evento de conversão específico (ex:
	// agendamento_de_visita), assim que tiver o nome exato dele.
	private readonly conversionEventName: string | null;
	private readonly cache = new TtlCache<Ga4Summary>(CACHE_TTL_MS, 100, cacheFilePath(__dirname, 'ga4-summary.json'));

	constructor() {
		const propertyId = process.env.GA4_PROPERTY_ID;
		const clientEmail = process.env.GA4_CLIENT_EMAIL;
		const privateKey = process.env.GA4_PRIVATE_KEY;

		if (!propertyId || !clientEmail || !privateKey) {
			throw new Error('Variáveis de ambiente GA4_PROPERTY_ID, GA4_CLIENT_EMAIL e GA4_PRIVATE_KEY são obrigatórias.');
		}

		this.propertyId = propertyId;
		this.conversionEventName = process.env.GA4_CONVERSION_EVENT_NAME || null;
		this.client = new BetaAnalyticsDataClient({
			credentials: {
				client_email: clientEmail,
				// Chaves privadas coladas em .env costumam vir com "\n" literal em vez de quebra de
				// linha real — sem esse replace, a lib de assinatura JWT do Google rejeita a chave.
				private_key: privateKey.replace(/\\n/g, '\n'),
			},
		});
	}

	private assertOk(error: unknown): never {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
			throw new Error(
				`Falha na API do GA4: permissão negada. Verifique se a service account (${process.env.GA4_CLIENT_EMAIL}) ` +
					'tem acesso de Viewer na propriedade GA4 configurada em GA4_PROPERTY_ID.',
			);
		}
		if (message.includes('NOT_FOUND') || message.includes('404')) {
			throw new Error(`Falha na API do GA4: propriedade '${process.env.GA4_PROPERTY_ID}' não encontrada.`);
		}
		throw new Error(`Falha na API do GA4: ${message}`);
	}

	public async fetchSummary(params: FetchSummaryParams): Promise<Ga4Summary> {
		const cacheKey = JSON.stringify(params);
		const cached = this.cache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando resumo do GA4 da memória.');
			return cached;
		}

		console.error('[CACHE MISS] Buscando resumo na API do GA4.');
		const dateRange = { startDate: `${params.numOfDays}daysAgo`, endDate: 'today' };

		let mainReport;
		try {
			[mainReport] = await this.client.runReport({
				property: `properties/${this.propertyId}`,
				dateRanges: [dateRange],
				dimensions: [{ name: 'pagePath' }, { name: 'deviceCategory' }],
				metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
			});
		} catch (error) {
			this.assertOk(error);
		}

		const pageTotals = new Map<string, number>();
		const deviceTotals = new Map<string, number>();
		let sessions = 0;
		let totalUsers = 0;
		for (const row of mainReport.rows ?? []) {
			const page = row.dimensionValues?.[0]?.value ?? '(desconhecida)';
			const device = row.dimensionValues?.[1]?.value ?? '(desconhecido)';
			const rowSessions = Number(row.metricValues?.[0]?.value ?? 0);
			const rowUsers = Number(row.metricValues?.[1]?.value ?? 0);
			pageTotals.set(page, (pageTotals.get(page) ?? 0) + rowSessions);
			deviceTotals.set(device, (deviceTotals.get(device) ?? 0) + rowSessions);
			sessions += rowSessions;
			totalUsers += rowUsers;
		}

		let conversions: number | null = null;
		if (this.conversionEventName) {
			try {
				const [conversionReport] = await this.client.runReport({
					property: `properties/${this.propertyId}`,
					dateRanges: [dateRange],
					metrics: [{ name: 'eventCount' }],
					dimensionFilter: {
						filter: {
							fieldName: 'eventName',
							stringFilter: { value: this.conversionEventName, matchType: 'EXACT' },
						},
					},
				});
				conversions = Number(conversionReport.rows?.[0]?.metricValues?.[0]?.value ?? 0);
			} catch (error) {
				this.assertOk(error);
			}
		}

		const topN = (totals: Map<string, number>, limit: number) =>
			[...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

		const result = ga4SummarySchema.parse({
			sessions,
			totalUsers,
			conversions,
			conversionEventName: this.conversionEventName,
			topPagesBySessions: topN(pageTotals, 5).map(([page, s]) => ({ page, sessions: s })),
			sessionsByDevice: topN(deviceTotals, 5).map(([device, s]) => ({ device, sessions: s })),
		});

		this.cache.set(cacheKey, result);
		return result;
	}
}
