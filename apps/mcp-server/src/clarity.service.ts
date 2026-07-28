import {
	ClarityInsights,
	clarityInsightsSchema,
	ClarityRegionInsights,
	clarityRegionInsightsSchema,
} from './clarity.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

// A API pública do Clarity impõe um limite duro de 10 requisições/dia por projeto
// (imposto pela Microsoft, não por nós). Cada combinação distinta de parâmetros
// (numOfDays/url/device) é uma chave de cache separada — ou seja, um novo gasto de cota.
// TTL de 6h (subiu de 3h): o chat não chama mais essas tools (ver EXCLUDED_FROM_CHAT em
// apps/dashboard/src/lib/mcp-tools.ts) e os filtros de /insights viraram opções fixas (não
// mais texto livre) — com isso o número de combinações possíveis por dia é pequeno e
// conhecido, e 6h de cache deixa bem mais folga de cota sem travar a atualização por um dia
// inteiro. O cache é persistido em disco (ver TtlCache): sem isso, cada reinício do servidor
// MCP (tsx watch em dev, deploy/crash em produção) zerava o cache em memória e a próxima
// pergunta da IA voltava a gastar cota, mesmo com poucos minutos de uso.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Confirmado com uma chamada real à API (não documentado publicamente pela Microsoft):
// cada item do array de resposta é uma métrica (`metricName`), e cada linha de
// `information[]` traz o valor sob `sessionsCount` (cliques/erros) ou `totalSessionCount`
// (tráfego) — NUNCA um campo com o nome da métrica embutido (ex: não existe
// `rageClickCount`). É o `metricName` do item pai que diz o que aquela linha representa.
// Quando as 3 dimensões abaixo são pedidas, cada linha também traz `Url`, `Device` e
// `Browser` (exatamente com essa capitalização) referentes ao recorte daquela linha.
//
// Limitação observada (não documentada pela Microsoft): `information[]` parece truncar em
// ~1000 linhas por métrica em projetos de alto tráfego, e os totais somados a partir dela
// variam um pouco entre chamadas muito próximas mesmo pedindo a mesma janela de dias —
// provavelmente amostragem/ordenação não determinística do lado da API, não um bug daqui
// (verificado comparando duas chamadas reais segundos uma da outra). Trate os totais como
// aproximações "de boa-fé" da API, não como contagem exata garantida.
const METRIC_NAMES = {
	traffic: 'Traffic',
	engagement: 'EngagementTime',
	rageClicks: 'RageClickCount',
	deadClicks: 'DeadClickCount',
	scriptErrors: 'ScriptErrorCount',
	// Já vinham na mesma resposta da chamada principal (a API sempre devolve o conjunto fixo de
	// métricas, filtramos client-side por metricName) — só não líamos essas duas ainda.
	// "Rolagem excessiva" e "Retornos rápidos" na UI web do próprio Clarity.
	excessiveScroll: 'ExcessiveScroll',
	quickBackClicks: 'QuickbackClick',
} as const;

interface FetchInsightsParams {
	numOfDays: number;
	url?: string;
	device?: string;
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
	// Cache separado: essa chamada usa outras dimensões (Device/OS/Country) e só é feita pelo
	// digest diário (nunca pela navegação interativa), então tem seu próprio orçamento de cota.
	private readonly regionCache = new TtlCache<ClarityRegionInsights>(
		CACHE_TTL_MS,
		500,
		cacheFilePath(__dirname, 'clarity-region-insights.json'),
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

	// Arredondado a 2 casas, igual ao estilo "23,71%" que a própria UI web do Clarity mostra.
	private percentOf(part: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((part / total) * 10000) / 100;
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

	// Chave composta Url+Device+Browser — permite cruzar linhas de métricas diferentes que
	// descrevem o mesmo recorte (ex: quantas sessões do Traffic tiveram activeTime zerado
	// no EngagementTime), já que a API não dá um ID de linha compartilhado entre métricas.
	private compositeKey(row: Record<string, any>): string {
		return ['Url', 'Device', 'Browser'].map((field) => String(this.field(row, field) ?? '')).join('|');
	}

	// Proxy de "tráfego não qualificado/possível bot": a API do Clarity não expõe um sinal de
	// bot de verdade (confirmado testando a API ao vivo — não existe essa métrica), então
	// aproximamos como sessões cujo recorte (Url+Device+Browser) teve activeTime = 0 no
	// EngagementTime. É uma estimativa por recorte, não uma contagem por sessão individual —
	// deixado claro também na UI que consome este campo.
	private lowEngagementSessions(
		trafficRows: Record<string, any>[],
		engagementRows: Record<string, any>[],
	): number {
		const zeroActiveKeys = new Set<string>();
		for (const row of engagementRows) {
			if ((Number(this.field(row, 'activeTime')) || 0) === 0) {
				zeroActiveKeys.add(this.compositeKey(row));
			}
		}
		let total = 0;
		for (const row of trafficRows) {
			if (zeroActiveKeys.has(this.compositeKey(row))) {
				total += Number(this.field(row, 'totalSessionCount')) || 0;
			}
		}
		return total;
	}

	// Requisição bruta compartilhada pelas duas chamadas do Clarity (insights principais e
	// breakdown de região) — só muda a lista de dimensões pedida.
	private async fetchRawMetrics(numOfDays: number, dimensions: string[]): Promise<RawMetric[]> {
		const query = new URLSearchParams({ numOfDays: String(numOfDays) });
		dimensions.forEach((dim, i) => query.set(`dimension${i + 1}`, dim));

		const url = `https://www.clarity.ms/export-data/api/v1/project-live-insights?${query.toString()}`;
		const response = await fetch(url, { headers: { Authorization: `Bearer ${this.apiToken}` } });
		await this.assertOk(response);

		const data = (await response.json()) as RawMetric[];
		console.error('[CLARITY RAW]', JSON.stringify(data).slice(0, 500));
		return Array.isArray(data) ? data : [];
	}

	public async fetchInsights(params: FetchInsightsParams): Promise<ClarityInsights> {
		const cacheKey = JSON.stringify(params);
		const cached = this.cache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando insights do Clarity da memória (cota diária protegida).');
			return cached;
		}

		console.error('[CACHE MISS] Buscando insights na API do Clarity (consome cota diária).');
		// Sempre pedimos as 3 dimensões (teto da API): sem isso, os detalhamentos por página/
		// dispositivo/navegador não vêm na resposta — só os totais agregados.
		const metrics = await this.fetchRawMetrics(params.numOfDays, ['URL', 'Device', 'Browser']);

		let trafficRows = this.rowsFor(metrics, METRIC_NAMES.traffic);
		let engagementRows = this.rowsFor(metrics, METRIC_NAMES.engagement);
		let rageRows = this.rowsFor(metrics, METRIC_NAMES.rageClicks);
		let deadRows = this.rowsFor(metrics, METRIC_NAMES.deadClicks);
		let scriptRows = this.rowsFor(metrics, METRIC_NAMES.scriptErrors);
		let excessiveScrollRows = this.rowsFor(metrics, METRIC_NAMES.excessiveScroll);
		let quickBackRows = this.rowsFor(metrics, METRIC_NAMES.quickBackClicks);

		// `url`/`device` filtram por um trecho do respectivo campo (busca parcial,
		// case-insensitive) — aplicados depois da chamada, já que a API não tem parâmetro de
		// filtro por valor (só as 3 dimensões pedidas, que vêm todas juntas na mesma resposta).
		if (params.url) {
			const needle = params.url.toLowerCase();
			const matchesUrl = (row: Record<string, any>) =>
				String(this.field(row, 'Url') ?? '').toLowerCase().includes(needle);
			trafficRows = trafficRows.filter(matchesUrl);
			engagementRows = engagementRows.filter(matchesUrl);
			rageRows = rageRows.filter(matchesUrl);
			deadRows = deadRows.filter(matchesUrl);
			scriptRows = scriptRows.filter(matchesUrl);
			excessiveScrollRows = excessiveScrollRows.filter(matchesUrl);
			quickBackRows = quickBackRows.filter(matchesUrl);
		}
		if (params.device) {
			const needle = params.device.toLowerCase();
			const matchesDevice = (row: Record<string, any>) =>
				String(this.field(row, 'Device') ?? '').toLowerCase().includes(needle);
			trafficRows = trafficRows.filter(matchesDevice);
			engagementRows = engagementRows.filter(matchesDevice);
			rageRows = rageRows.filter(matchesDevice);
			deadRows = deadRows.filter(matchesDevice);
			scriptRows = scriptRows.filter(matchesDevice);
			excessiveScrollRows = excessiveScrollRows.filter(matchesDevice);
			quickBackRows = quickBackRows.filter(matchesDevice);
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
		const scriptErrorsByPage = this.groupSum(scriptRows, 'Url', 'sessionsCount', 5).map((r) => ({
			url: r.key,
			count: r.count,
		}));
		const lowEngagementSessions = this.lowEngagementSessions(trafficRows, engagementRows);
		const totalSessions = this.sum(trafficRows, 'totalSessionCount');
		const rageClicks = this.sum(rageRows, 'sessionsCount');
		const deadClicks = this.sum(deadRows, 'sessionsCount');
		const scriptErrors = this.sum(scriptRows, 'sessionsCount');
		const excessiveScrollSessions = this.sum(excessiveScrollRows, 'sessionsCount');
		const quickBackSessions = this.sum(quickBackRows, 'sessionsCount');

		const result = clarityInsightsSchema.parse({
			totalSessions,
			rageClicks,
			deadClicks,
			scriptErrors,
			// Mesmo estilo de exibição da própria UI web do Clarity ("X% — N sessões"): % de
			// sessões afetadas, não uma contagem solta sem contexto do tamanho da amostra.
			rageClickPercent: this.percentOf(rageClicks, totalSessions),
			deadClickPercent: this.percentOf(deadClicks, totalSessions),
			scriptErrorPercent: this.percentOf(scriptErrors, totalSessions),
			excessiveScrollSessions,
			excessiveScrollPercent: this.percentOf(excessiveScrollSessions, totalSessions),
			quickBackSessions,
			quickBackPercent: this.percentOf(quickBackSessions, totalSessions),
			topPages,
			rageClicksByPage,
			deadClicksByPage,
			scriptErrorsByPage,
			sessionsByDevice,
			sessionsByBrowser,
			lowEngagementSessions,
		});

		this.cache.set(cacheKey, result);
		return result;
	}

	// Breakdown por Device/OS/Country — chamada separada da principal, com dimensões
	// diferentes (a API do Clarity aceita no máximo 3 dimensões por requisição, e a chamada
	// principal já usa URL+Device+Browser). Só o digest diário chama este método: assim o
	// custo extra de cota fica limitado à cadência do próprio cron (~1x/dia), sem competir com
	// a navegação interativa do dashboard pela cota de 10 requisições/dia do Clarity.
	public async fetchRegionBreakdown(params: { numOfDays: number }): Promise<ClarityRegionInsights> {
		const cacheKey = JSON.stringify(params);
		const cached = this.regionCache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando breakdown de região do Clarity da memória.');
			return cached;
		}

		console.error('[CACHE MISS] Buscando breakdown de região na API do Clarity (consome cota diária).');
		const metrics = await this.fetchRawMetrics(params.numOfDays, ['Device', 'OS', 'Country']);
		const trafficRows = this.rowsFor(metrics, METRIC_NAMES.traffic);

		const result = clarityRegionInsightsSchema.parse({
			sessionsByOS: this.groupSum(trafficRows, 'OS', 'totalSessionCount', 5).map((r) => ({
				os: r.key,
				count: r.count,
			})),
			sessionsByCountry: this.groupSum(trafficRows, 'Country', 'totalSessionCount', 5).map((r) => ({
				country: r.key,
				count: r.count,
			})),
		});

		this.regionCache.set(cacheKey, result);
		return result;
	}
}
