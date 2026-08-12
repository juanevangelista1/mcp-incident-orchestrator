import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { Ga4Summary, ga4SummarySchema } from './ga4.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

interface FetchSummaryParams {
	numOfDays: number;
	// Data absoluta (AAAA-MM-DD) — quando os dois vêm preenchidos, sobrepõe numOfDays. Existe
	// pro seletor de datas do dashboard (cada card filtra seu próprio intervalo, não só
	// "últimos N dias"); a API do GA4 aceita os dois formatos no mesmo campo `dateRanges`.
	startDate?: string;
	endDate?: string;
	// Filtro opcional por trecho da URL (contains, mesmo estilo do filtro `url` do Clarity) —
	// usado pelo comparador de rotas pra pegar sessões/conversões de UMA rota específica em
	// vez do total do site.
	pagePath?: string;
	// Filtro opcional por categoria de dispositivo (contains — a API devolve valores como
	// "desktop"/"mobile"/"tablet"), mesmo estilo do filtro `device` do Clarity.
	device?: string;
	// Filtro opcional só pra contagem de eventos (contains) — sem isso, um evento de baixo
	// volume (ex: visit_schedule_completed_venda) pode ficar fora do TOP_N_LIMIT junto de
	// eventos genéricos de alto volume (page_view, scroll, click).
	eventName?: string;
}

type FilterExpr = { filter: { fieldName: string; stringFilter: { value: string; matchType: 'CONTAINS' | 'EXACT' } } };

// Combina os filtros ativos com AND — devolve undefined (não filtrar) se nenhum, o filtro
// puro se só um, ou andGroup se mais de um. Reaproveitado pelos 3 reports desta service em
// vez de repetir a mesma lógica de combinação 3 vezes.
function combineFilters(...filters: (FilterExpr | undefined)[]): FilterExpr | { andGroup: { expressions: FilterExpr[] } } | undefined {
	const active = filters.filter((f): f is FilterExpr => Boolean(f));
	if (active.length === 0) return undefined;
	if (active.length === 1) return active[0];
	return { andGroup: { expressions: active } };
}

// GA4 Data API não tem o teto duro de 10 req/dia do Clarity (cota padrão: 25 mil
// requisições/dia por propriedade) — cache aqui é só para evitar chamadas repetidas à toa
// durante a navegação normal do dashboard, não uma proteção de cota escassa como no Clarity.
const CACHE_TTL_MS = 60 * 60 * 1000;

// Mesma ideia do TOP_N_LIMIT em clarity.service.ts: dá pro dashboard paginar essas listas em
// vez de só mostrar um top 5 fixo, sem custo de chamada extra (é a mesma resposta, só um
// corte local maior).
const TOP_N_LIMIT = 25;

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
		const dateRange =
			params.startDate && params.endDate
				? { startDate: params.startDate, endDate: params.endDate }
				: { startDate: `${params.numOfDays}daysAgo`, endDate: 'today' };

		// `undefined` (não filtrar) quando o campo não é passado — a API do GA4 aceita
		// `dimensionFilter: undefined` normalmente.
		const pagePathFilter: FilterExpr | undefined = params.pagePath
			? {
					filter: {
						fieldName: 'pagePath',
						stringFilter: { value: params.pagePath, matchType: 'CONTAINS' as const },
					},
				}
			: undefined;
		const deviceFilter: FilterExpr | undefined = params.device
			? {
					filter: {
						fieldName: 'deviceCategory',
						stringFilter: { value: params.device, matchType: 'CONTAINS' as const },
					},
				}
			: undefined;
		const eventNameSearchFilter: FilterExpr | undefined = params.eventName
			? {
					filter: {
						fieldName: 'eventName',
						stringFilter: { value: params.eventName, matchType: 'CONTAINS' as const },
					},
				}
			: undefined;

		let mainReport;
		try {
			[mainReport] = await this.client.runReport({
				property: `properties/${this.propertyId}`,
				dateRanges: [dateRange],
				dimensions: [{ name: 'pagePath' }, { name: 'deviceCategory' }],
				metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
				dimensionFilter: combineFilters(pagePathFilter, deviceFilter),
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

		// Contagem por nome de evento — relatório à parte porque `eventName` é uma dimensão
		// própria do GA4 (não combina com pagePath/deviceCategory no mesmo report sem explodir
		// o número de linhas em combinações que ninguém pediu).
		const eventTotals = new Map<string, number>();
		try {
			const [eventsReport] = await this.client.runReport({
				property: `properties/${this.propertyId}`,
				dateRanges: [dateRange],
				dimensions: [{ name: 'eventName' }],
				metrics: [{ name: 'eventCount' }],
				dimensionFilter: combineFilters(pagePathFilter, deviceFilter, eventNameSearchFilter),
				orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
				limit: TOP_N_LIMIT,
			});
			for (const row of eventsReport.rows ?? []) {
				const eventName = row.dimensionValues?.[0]?.value ?? '(desconhecido)';
				const count = Number(row.metricValues?.[0]?.value ?? 0);
				eventTotals.set(eventName, count);
			}
		} catch (error) {
			this.assertOk(error);
		}

		let conversions: number | null = null;
		if (this.conversionEventName) {
			const conversionEventFilter: FilterExpr = {
				filter: {
					fieldName: 'eventName',
					stringFilter: { value: this.conversionEventName, matchType: 'EXACT' as const },
				},
			};
			try {
				const [conversionReport] = await this.client.runReport({
					property: `properties/${this.propertyId}`,
					dateRanges: [dateRange],
					metrics: [{ name: 'eventCount' }],
					// GA4 permite filtrar por uma dimensão (pagePath/deviceCategory) mesmo sem pedi-la
					// no resultado — combinamos com o filtro do evento de conversão via andGroup.
					dimensionFilter: combineFilters(conversionEventFilter, pagePathFilter, deviceFilter),
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
			topPagesBySessions: topN(pageTotals, TOP_N_LIMIT).map(([page, s]) => ({ page, sessions: s })),
			sessionsByDevice: topN(deviceTotals, TOP_N_LIMIT).map(([device, s]) => ({ device, sessions: s })),
			eventsByName: topN(eventTotals, TOP_N_LIMIT).map(([eventName, count]) => ({ eventName, count })),
		});

		this.cache.set(cacheKey, result);
		return result;
	}
}
