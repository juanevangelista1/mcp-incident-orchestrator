import { ClarityInsights, clarityInsightsSchema } from './clarity.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

// A API pública do Clarity impõe um limite duro de 10 requisições/dia por projeto
// (imposto pela Microsoft, não por nós). Por isso o TTL aqui é bem mais agressivo que o do
// Sentry/Datadog (1 hora), e o cache é persistido em disco (ver TtlCache): sem isso, cada
// reinício do servidor MCP (tsx watch em dev, deploy/crash em produção) zerava o cache em
// memória e a próxima pergunta da IA voltava a gastar cota, mesmo com poucos minutos de uso.
const CACHE_TTL_MS = 60 * 60 * 1000;

// Confirmado com uma chamada real à API (não documentado publicamente pela Microsoft):
// cada item do array de resposta é uma métrica (`metricName`), e cada linha de
// `information[]` traz o valor sob `sessionsCount` (cliques/erros) ou `totalSessionCount`
// (tráfego) — NUNCA um campo com o nome da métrica embutido (ex: não existe
// `rageClickCount`). É o `metricName` do item pai que diz o que aquela linha representa.
// Quando as 3 dimensões abaixo são pedidas, cada linha também traz `Url`, `Device` e
// `Browser` (exatamente com essa capitalização) referentes ao recorte daquela linha.
const METRIC_NAMES = {
	traffic: 'Traffic',
	rageClicks: 'RageClickCount',
	deadClicks: 'DeadClickCount',
	scriptErrors: 'ScriptErrorCount',
} as const;

interface FetchInsightsParams {
	numOfDays: number;
	url?: string;
}

interface RawMetric {
	metricName?: string;
	information?: Record<string, any>[];
}

export class ClarityService {
	private readonly apiToken: string;
	private readonly cache = new TtlCache<ClarityInsights>(
		CACHE_TTL_MS,
		500,
		cacheFilePath(__dirname, 'clarity-insights.json'),
	);

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

	// Acesso case-insensitive a um campo de uma linha — a API já demonstrou inconsistência de
	// capitalização entre chamadas com e sem dimensões explícitas (`url` vs `Url`).
	private field(row: Record<string, any>, name: string): any {
		const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
		return key ? row[key] : undefined;
	}

	private rowsFor(metrics: RawMetric[], metricName: string): Record<string, any>[] {
		return metrics.filter((m) => m.metricName === metricName).flatMap((m) => m.information ?? []);
	}

	private sum(rows: Record<string, any>[], valueField: string): number {
		return rows.reduce((total, row) => total + (Number(this.field(row, valueField)) || 0), 0);
	}

	// Agrupa linhas por um campo de dimensão (Url/Device/Browser) somando o campo de valor,
	// devolvendo os `limit` maiores — mesmo padrão usado pelas 4 fontes para "top N".
	private groupSum(
		rows: Record<string, any>[],
		keyField: string,
		valueField: string,
		limit: number,
	): { key: string; count: number }[] {
		const totals = new Map<string, number>();
		for (const row of rows) {
			const key = this.field(row, keyField);
			if (typeof key !== 'string') continue;
			totals.set(key, (totals.get(key) ?? 0) + (Number(this.field(row, valueField)) || 0));
		}
		return [...totals.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([key, count]) => ({ key, count }));
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
		// Sempre pedimos as 3 dimensões (teto da API): sem isso, os detalhamentos por página/
		// dispositivo/navegador não vêm na resposta — só os totais agregados.
		query.set('dimension1', 'URL');
		query.set('dimension2', 'Device');
		query.set('dimension3', 'Browser');

		const url = `https://www.clarity.ms/export-data/api/v1/project-live-insights?${query.toString()}`;
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${this.apiToken}` },
		});

		await this.assertOk(response);

		const data = (await response.json()) as RawMetric[];
		console.error('[CLARITY RAW]', JSON.stringify(data).slice(0, 500));

		const metrics = Array.isArray(data) ? data : [];

		let trafficRows = this.rowsFor(metrics, METRIC_NAMES.traffic);
		let rageRows = this.rowsFor(metrics, METRIC_NAMES.rageClicks);
		let deadRows = this.rowsFor(metrics, METRIC_NAMES.deadClicks);
		let scriptRows = this.rowsFor(metrics, METRIC_NAMES.scriptErrors);

		// `url` filtra por um trecho da URL/rota (busca parcial, case-insensitive) — aplicado
		// depois da chamada, já que a API não tem um parâmetro de filtro por valor de URL.
		if (params.url) {
			const needle = params.url.toLowerCase();
			const matchesUrl = (row: Record<string, any>) =>
				String(this.field(row, 'Url') ?? '').toLowerCase().includes(needle);
			trafficRows = trafficRows.filter(matchesUrl);
			rageRows = rageRows.filter(matchesUrl);
			deadRows = deadRows.filter(matchesUrl);
			scriptRows = scriptRows.filter(matchesUrl);
		}

		const topPages = this.groupSum(trafficRows, 'Url', 'totalSessionCount', 5).map((r) => ({
			url: r.key,
			sessions: r.count,
		}));
		const rageClicksByPage = this.groupSum(rageRows, 'Url', 'sessionsCount', 5).map((r) => ({
			url: r.key,
			count: r.count,
		}));
		const deadClicksByPage = this.groupSum(deadRows, 'Url', 'sessionsCount', 5).map((r) => ({
			url: r.key,
			count: r.count,
		}));
		const sessionsByDevice = this.groupSum(trafficRows, 'Device', 'totalSessionCount', 5).map((r) => ({
			device: r.key,
			count: r.count,
		}));
		const sessionsByBrowser = this.groupSum(trafficRows, 'Browser', 'totalSessionCount', 5).map((r) => ({
			browser: r.key,
			count: r.count,
		}));

		const result = clarityInsightsSchema.parse({
			totalSessions: this.sum(trafficRows, 'totalSessionCount'),
			rageClicks: this.sum(rageRows, 'sessionsCount'),
			deadClicks: this.sum(deadRows, 'sessionsCount'),
			scriptErrors: this.sum(scriptRows, 'sessionsCount'),
			topPages,
			rageClicksByPage,
			deadClicksByPage,
			sessionsByDevice,
			sessionsByBrowser,
		});

		this.cache.set(cacheKey, result);
		return result;
	}
}
