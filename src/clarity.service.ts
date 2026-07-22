import { ClarityInsights, clarityInsightsSchema } from './clarity.schema';
import { TtlCache } from './lib/ttl-cache';

// A API pública do Clarity impõe um limite duro de 10 requisições/dia por projeto
// (imposto pela Microsoft, não por nós). Por isso o cache aqui é bem mais agressivo
// que o do Sentry/Datadog: 10 minutos, para não estourar a cota com poucas perguntas da IA.
const CACHE_TTL_MS = 10 * 60 * 1000;

// Candidatos de nome de campo aceitos ao procurar cada métrica na resposta.
// Nota de honestidade técnica: a documentação pública do Clarity é escassa e não encontrei
// uma referência 100% confiável do shape exato de cada `information[]`. O parsing abaixo
// varre todas as métricas retornadas procurando por esses nomes, em vez de assumir uma
// posição fixa — se você testar com um token real e a extração vier zerada, verifique o
// JSON bruto (log de [CLARITY RAW]) e ajuste as listas de candidatos abaixo.
const FIELD_CANDIDATES = {
	sessions: ['totalSessionCount', 'sessionsCount', 'sessionCount'],
	rageClicks: ['totalRageClickCount', 'rageClickCount'],
	deadClicks: ['totalDeadClickCount', 'deadClickCount'],
	scriptErrors: ['totalScriptErrorCount', 'scriptErrorCount'],
};

interface FetchInsightsParams {
	numOfDays: number;
	url?: string;
}

export class ClarityService {
	private readonly apiToken: string;
	private readonly cache = new TtlCache<ClarityInsights>(CACHE_TTL_MS);

	constructor() {
		const token = process.env.CLARITY_API_TOKEN;
		if (!token) {
			throw new Error('Variável de ambiente CLARITY_API_TOKEN é obrigatória.');
		}
		this.apiToken = token;
	}

	private async assertOk(response: Response): Promise<void> {
		if (response.ok) return;

		if (response.status === 401 || response.status === 403) {
			throw new Error(
				`Falha na API do Clarity: ${response.status} ${response.statusText}. Verifique se CLARITY_API_TOKEN é válido.`,
			);
		}
		if (response.status === 429) {
			throw new Error(
				'Rate limit do Clarity excedido (limite: 10 requisições/dia por projeto). Aguarde até amanhã ou use um resultado já em cache.',
			);
		}
		throw new Error(`Falha na API do Clarity: ${response.status} ${response.statusText}`);
	}

	// Varre todas as métricas retornadas em busca do primeiro campo cujo nome bate com
	// algum dos candidatos, e soma os valores numéricos encontrados nas linhas de `information`.
	private sumField(rows: Record<string, any>[], candidates: string[]): number {
		let total = 0;
		for (const row of rows) {
			for (const key of Object.keys(row)) {
				if (candidates.some((c) => c.toLowerCase() === key.toLowerCase())) {
					total += Number(row[key]) || 0;
				}
			}
		}
		return total;
	}

	public async fetchInsights(params: FetchInsightsParams): Promise<ClarityInsights> {
		const cacheKey = JSON.stringify(params);
		const cached = this.cache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando insights do Clarity da memória (cota diária protegida).');
			return cached;
		}

		console.error('[CACHE MISS] Buscando insights na API do Clarity (consome cota diária).');
		const query = new URLSearchParams({ numOfDays: String(params.numOfDays) });
		if (params.url) query.set('dimension1', 'URL');

		const url = `https://www.clarity.ms/export-data/api/v1/project-live-insights?${query.toString()}`;
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${this.apiToken}` },
		});

		await this.assertOk(response);

		const data = await response.json();
		console.error('[CLARITY RAW]', JSON.stringify(data).slice(0, 500));

		// Achata todas as métricas em uma única lista de linhas para procurar os campos
		// que precisamos, independentemente de sob qual `metricName` a API os agrupou.
		const allRows: Record<string, any>[] = Array.isArray(data)
			? data.flatMap((metric: any) => metric?.information ?? [])
			: [];

		const pageRows = allRows.filter((row) => typeof row.url === 'string');
		const topPages = pageRows
			.map((row) => ({
				url: row.url,
				sessions: Number(row.sessionsCount ?? row.visitsCount ?? row.subTotal ?? 0),
			}))
			.sort((a, b) => b.sessions - a.sessions)
			.slice(0, 5);

		const result = clarityInsightsSchema.parse({
			totalSessions: this.sumField(allRows, FIELD_CANDIDATES.sessions),
			rageClicks: this.sumField(allRows, FIELD_CANDIDATES.rageClicks),
			deadClicks: this.sumField(allRows, FIELD_CANDIDATES.deadClicks),
			scriptErrors: this.sumField(allRows, FIELD_CANDIDATES.scriptErrors),
			topPages,
		});

		this.cache.set(cacheKey, result);
		return result;
	}
}
