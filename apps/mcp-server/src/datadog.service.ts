import {
	DatadogLogEntry,
	DatadogLogDetails,
	DatadogLogsSummary,
	datadogLogEntrySchema,
	datadogLogDetailsSchema,
} from './datadog.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

interface LogQueryParams {
	query?: string;
	service?: string;
	environment?: string;
	minutesAgo: number;
}

export class DatadogService {
	private readonly apiKey: string;
	private readonly appKey: string;
	private readonly site: string;

	// Mesma proteção usada no SentryService: se a IA repetir a mesma busca em poucos segundos,
	// respondemos da memória em vez de gastar mais uma chamada (o Datadog cobra por consulta de log).
	private readonly searchCache = new TtlCache<DatadogLogEntry[]>(
		30_000,
		500,
		cacheFilePath(__dirname, 'datadog-search.json'),
	);
	private readonly detailsCache = new TtlCache<DatadogLogDetails>(
		60_000,
		500,
		cacheFilePath(__dirname, 'datadog-log-details.json'),
	);

	constructor() {
		const apiKey = process.env.DATADOG_API_KEY;
		const appKey = process.env.DATADOG_APP_KEY;

		if (!apiKey || !appKey) {
			throw new Error('Variáveis de ambiente DATADOG_API_KEY e DATADOG_APP_KEY são obrigatórias.');
		}

		this.apiKey = apiKey;
		this.appKey = appKey;
		// DD_SITE varia por conta (datadoghq.com, datadoghq.eu, us3.datadoghq.com, us5.datadoghq.com, ap1.datadoghq.com).
		this.site = process.env.DATADOG_SITE || 'datadoghq.com';
	}

	private authHeaders(): HeadersInit {
		return {
			'DD-API-KEY': this.apiKey,
			'DD-APPLICATION-KEY': this.appKey,
			'Content-Type': 'application/json',
		};
	}

	private async assertOk(response: Response, context: string): Promise<void> {
		if (response.ok) return;

		if (response.status === 401 || response.status === 403) {
			throw new Error(
				`Falha ao ${context}: ${response.status} ${response.statusText}. ` +
					`Verifique se DATADOG_API_KEY/DATADOG_APP_KEY estão corretas e se a Application Key tem a permissão 'logs_read_data'.`,
			);
		}

		if (response.status === 429) {
			throw new Error(`Rate limit do Datadog excedido ao ${context}. Aguarde alguns segundos e tente de novo.`);
		}

		throw new Error(`Falha ao ${context}: ${response.status} ${response.statusText}`);
	}

	// Montagem única da query no formato de tags do Datadog (ex: "service:api env:production timeout"),
	// reaproveitada por queryLogs, countLogs e (indiretamente) summarizeLogs.
	private buildSearchQuery(params: LogQueryParams): string {
		const filters: string[] = [];
		if (params.query) filters.push(params.query);
		if (params.service) filters.push(`service:${params.service}`);
		if (params.environment) filters.push(`env:${params.environment}`);
		return filters.length > 0 ? filters.join(' ') : '*';
	}

	// Captura: lista os logs mais recentes que casam com o filtro.
	public async queryLogs(params: LogQueryParams & { limit: number }): Promise<DatadogLogEntry[]> {
		const cacheKey = JSON.stringify(params);
		const cached = this.searchCache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando logs do Datadog da memória.');
			return cached;
		}

		console.error('[CACHE MISS] Buscando logs na API do Datadog.');
		const url = `https://api.${this.site}/api/v2/logs/events/search`;
		const response = await fetch(url, {
			method: 'POST',
			headers: this.authHeaders(),
			body: JSON.stringify({
				filter: {
					query: this.buildSearchQuery(params),
					from: `now-${params.minutesAgo}m`,
					to: 'now',
				},
				sort: '-timestamp',
				page: { limit: params.limit },
			}),
		});

		await this.assertOk(response, 'buscar logs');

		const data = await response.json();

		// Fronteira da Anti-Corruption Layer: validamos contra o schema em vez de confiar
		// cegamente no shape do JSON do Datadog.
		const logs = datadogLogEntrySchema.array().parse(
			(data.data || []).map((entry: any) => ({
				id: entry.id,
				timestamp: entry.attributes?.timestamp ?? 'desconhecido',
				service: entry.attributes?.service ?? 'desconhecido',
				status: entry.attributes?.status ?? 'desconhecido',
				message: entry.attributes?.message ?? '',
				host: entry.attributes?.host ?? 'desconhecido',
			})),
		);

		this.searchCache.set(cacheKey, logs);
		return logs;
	}

	// Quantidade de logs: usa o endpoint de agregação (analytics/aggregate), que devolve só a
	// contagem, em vez de baixar o corpo de cada log só para contar o tamanho do array.
	public async countLogs(params: LogQueryParams): Promise<number> {
		const url = `https://api.${this.site}/api/v2/logs/analytics/aggregate`;
		const response = await fetch(url, {
			method: 'POST',
			headers: this.authHeaders(),
			body: JSON.stringify({
				filter: {
					query: this.buildSearchQuery(params),
					from: `now-${params.minutesAgo}m`,
					to: 'now',
				},
				compute: [{ aggregation: 'count' }],
			}),
		});

		await this.assertOk(response, 'contar logs');

		const data = await response.json();
		const count = data.data?.buckets?.[0]?.computes?.c0;
		return count ? parseInt(count, 10) : 0;
	}

	// Resumo dos logs: NÃO faz uma nova chamada de rede. Reaproveita queryLogs (até 50 logs)
	// e agrega em memória — mesma decisão de design do summarizeIssues no SentryService.
	public async summarizeLogs(params: LogQueryParams): Promise<DatadogLogsSummary> {
		const logs = await this.queryLogs({ ...params, limit: 50 });

		const statusCounts = new Map<string, number>();
		const serviceCounts = new Map<string, number>();
		for (const log of logs) {
			statusCounts.set(log.status, (statusCounts.get(log.status) ?? 0) + 1);
			serviceCounts.set(log.service, (serviceCounts.get(log.service) ?? 0) + 1);
		}

		const sortedDesc = (counts: Map<string, number>) =>
			[...counts.entries()].sort((a, b) => b[1] - a[1]);

		return {
			totalLogs: logs.length,
			byStatus: sortedDesc(statusCounts).map(([status, count]) => ({ status, count })),
			byService: sortedDesc(serviceCounts).map(([service, count]) => ({ service, count })),
		};
	}

	// Detalhes de um log específico (todas as tags, sem truncamento) — sob demanda, com cache.
	public async getLogDetails(logId: string): Promise<DatadogLogDetails> {
		const cached = this.detailsCache.get(logId);
		if (cached) {
			console.error(`[CACHE HIT] Retornando detalhes do log ${logId} da memória.`);
			return cached;
		}

		console.error(`[CACHE MISS] Buscando log ${logId} na API do Datadog.`);
		const url = `https://api.${this.site}/api/v2/logs/events/${encodeURIComponent(logId)}`;
		const response = await fetch(url, { headers: this.authHeaders() });
		await this.assertOk(response, `buscar os detalhes do log '${logId}'`);

		const data = await response.json();
		const attributes = data.data?.attributes;
		const rawTags: string[] = attributes?.tags ?? [];
		const tags = rawTags.reduce((acc: Record<string, string>, tag: string) => {
			const [key, value] = tag.split(':');
			if (key && value) acc[key] = value;
			return acc;
		}, {});

		const result = datadogLogDetailsSchema.parse({
			id: data.data?.id,
			timestamp: attributes?.timestamp ?? 'desconhecido',
			service: attributes?.service ?? 'desconhecido',
			status: attributes?.status ?? 'desconhecido',
			message: attributes?.message ?? '',
			host: attributes?.host ?? 'desconhecido',
			tags,
		});

		this.detailsCache.set(logId, result);
		return result;
	}
}
