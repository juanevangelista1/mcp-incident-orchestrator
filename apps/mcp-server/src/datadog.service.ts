import {
	DatadogErrorIssue,
	DatadogErrorIssueDetails,
	DatadogApmTrace,
	datadogErrorIssueSchema,
	datadogErrorIssueDetailsSchema,
	datadogApmTraceSchema,
} from './datadog.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

interface ErrorIssueQueryParams {
	query?: string;
	minutesAgo: number;
	limit: number;
}

interface ApmTraceQueryParams {
	query?: string;
	minutesAgo: number;
	limit: number;
}

export class DatadogService {
	private readonly apiKey: string;
	private readonly appKey: string;
	private readonly site: string;

	// Mesma proteção usada no SentryService: se a IA repetir a mesma busca em poucos segundos,
	// respondemos da memória em vez de gastar mais uma chamada.
	private readonly errorIssuesCache = new TtlCache<DatadogErrorIssue[]>(
		30_000,
		500,
		cacheFilePath(__dirname, 'datadog-error-issues.json'),
	);
	private readonly errorIssueDetailsCache = new TtlCache<DatadogErrorIssueDetails>(
		60_000,
		500,
		cacheFilePath(__dirname, 'datadog-error-issue-details.json'),
	);
	private readonly apmTracesCache = new TtlCache<DatadogApmTrace[]>(
		30_000,
		500,
		cacheFilePath(__dirname, 'datadog-apm-traces.json'),
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
					`Verifique se DATADOG_API_KEY/DATADOG_APP_KEY estão corretas.`,
			);
		}

		if (response.status === 429) {
			throw new Error(`Rate limit do Datadog excedido ao ${context}. Aguarde alguns segundos e tente de novo.`);
		}

		throw new Error(`Falha ao ${context}: ${response.status} ${response.statusText}`);
	}

	// Error Tracking: agrupa erros de aplicação (APM/RUM/backend) em issues — não depende de
	// Logs estar configurado no Datadog (que precisa de um log source explícito no onboarding).
	// Resultado da busca (`data`) só traz o total_count; os campos de verdade (mensagem,
	// service, state) vêm em `included` e precisam ser cruzados pelo id — é assim que a API
	// do Datadog devolve (JSON:API).
	public async searchErrorIssues(params: ErrorIssueQueryParams): Promise<DatadogErrorIssue[]> {
		const cacheKey = JSON.stringify(params);
		const cached = this.errorIssuesCache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando issues do Error Tracking da memória.');
			return cached;
		}

		console.error('[CACHE MISS] Buscando issues na API de Error Tracking do Datadog.');
		const now = Date.now();
		const from = now - params.minutesAgo * 60_000;

		const url = `https://api.${this.site}/api/v2/error-tracking/issues/search?include=issue`;
		const response = await fetch(url, {
			method: 'POST',
			headers: this.authHeaders(),
			body: JSON.stringify({
				data: {
					type: 'search_request',
					attributes: {
						query: params.query || '*',
						from,
						to: now,
						persona: 'ALL',
						order_by: 'TOTAL_COUNT',
					},
				},
			}),
		});

		await this.assertOk(response, 'buscar issues do Error Tracking');

		const data = await response.json();
		const results: any[] = data.data ?? [];
		const includedById = new Map<string, any>((data.included ?? []).map((item: any) => [item.id, item]));

		const issues = datadogErrorIssueSchema.array().parse(
			results.slice(0, params.limit).map((result) => {
				const issueId = result.relationships?.issue?.data?.id ?? result.id;
				const attrs = includedById.get(issueId)?.attributes ?? {};
				return {
					id: issueId,
					errorMessage: attrs.error_message ?? 'desconhecido',
					errorType: attrs.error_type ?? 'desconhecido',
					service: attrs.service ?? 'desconhecido',
					platform: attrs.platform ?? 'desconhecido',
					state: attrs.state ?? 'desconhecido',
					isCrash: attrs.is_crash ?? false,
					firstSeen: attrs.first_seen ? new Date(attrs.first_seen).toISOString() : 'desconhecido',
					lastSeen: attrs.last_seen ? new Date(attrs.last_seen).toISOString() : 'desconhecido',
					totalCount: result.attributes?.total_count ?? 0,
				};
			}),
		);

		this.errorIssuesCache.set(cacheKey, issues);
		return issues;
	}

	// Detalhes de uma issue específica — sob demanda, com cache (mesmo padrão do
	// getLogDetails que existia para Logs). Sem `total_count` (ver comentário no schema).
	public async getErrorIssueDetails(issueId: string): Promise<DatadogErrorIssueDetails> {
		const cached = this.errorIssueDetailsCache.get(issueId);
		if (cached) {
			console.error(`[CACHE HIT] Retornando detalhes da issue ${issueId} da memória.`);
			return cached;
		}

		console.error(`[CACHE MISS] Buscando issue ${issueId} na API de Error Tracking do Datadog.`);
		const url = `https://api.${this.site}/api/v2/error-tracking/issues/${encodeURIComponent(issueId)}`;
		const response = await fetch(url, { headers: this.authHeaders() });
		await this.assertOk(response, `buscar os detalhes da issue '${issueId}'`);

		const data = await response.json();
		const attrs = data.data?.attributes ?? {};

		const result = datadogErrorIssueDetailsSchema.parse({
			id: data.data?.id ?? issueId,
			errorMessage: attrs.error_message ?? 'desconhecido',
			errorType: attrs.error_type ?? 'desconhecido',
			service: attrs.service ?? 'desconhecido',
			platform: attrs.platform ?? 'desconhecido',
			state: attrs.state ?? 'desconhecido',
			isCrash: attrs.is_crash ?? false,
			firstSeen: attrs.first_seen ? new Date(attrs.first_seen).toISOString() : 'desconhecido',
			lastSeen: attrs.last_seen ? new Date(attrs.last_seen).toISOString() : 'desconhecido',
			filePath: attrs.file_path ?? undefined,
			functionName: attrs.function_name ?? undefined,
			languages: attrs.languages ?? [],
			firstSeenVersion: attrs.first_seen_version ?? undefined,
			lastSeenVersion: attrs.last_seen_version ?? undefined,
			regression: attrs.regression
				? {
						regressedAt: new Date(attrs.regression.regressed_at).toISOString(),
						resolvedAt: new Date(attrs.regression.resolved_at).toISOString(),
					}
				: undefined,
		});

		this.errorIssueDetailsCache.set(issueId, result);
		return result;
	}

	// APM Traces/Spans: chamada individual (serviço → serviço, HTTP, duração) onde um erro
	// aconteceu — granularidade diferente do Error Tracking, que agrupa por issue "de negócio".
	// Sempre filtra por status:error (combinado com o texto livre do usuário, se houver).
	public async searchErrorTraces(params: ApmTraceQueryParams): Promise<DatadogApmTrace[]> {
		const cacheKey = JSON.stringify(params);
		const cached = this.apmTracesCache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando spans de erro da memória.');
			return cached;
		}

		console.error('[CACHE MISS] Buscando spans de erro na API de APM do Datadog.');
		const now = Date.now();
		const from = now - params.minutesAgo * 60_000;
		const query = ['status:error', params.query].filter(Boolean).join(' ');

		const url = `https://api.${this.site}/api/v2/spans/events/search`;
		const response = await fetch(url, {
			method: 'POST',
			headers: this.authHeaders(),
			body: JSON.stringify({
				data: {
					type: 'search_request',
					attributes: {
						filter: { query, from: String(from), to: String(now) },
						sort: '-timestamp',
						page: { limit: params.limit },
					},
				},
			}),
		});

		await this.assertOk(response, 'buscar spans de erro no APM');

		const data = await response.json();
		const spans: any[] = data.data ?? [];

		const traces = datadogApmTraceSchema.array().parse(
			spans.map((span) => {
				const attrs = span.attributes ?? {};
				const custom = attrs.custom ?? {};
				const http = custom.http ?? {};
				// Duração vem em nanossegundos na API — convertida pra ms, que é o que faz
				// sentido mostrar numa UI (ninguém lê "29583485 ns" de cabeça).
				const durationNs = typeof custom.duration === 'number' ? custom.duration : 0;

				return {
					id: span.id ?? 'desconhecido',
					traceId: attrs.trace_id ?? 'desconhecido',
					spanId: attrs.span_id ?? 'desconhecido',
					service: attrs.service ?? 'desconhecido',
					resourceName: attrs.resource_name ?? 'desconhecido',
					operationName: attrs.operation_name ?? 'desconhecido',
					status: attrs.status ?? 'desconhecido',
					env: attrs.env ?? 'desconhecido',
					httpMethod: http.method ?? undefined,
					httpStatusCode: http.status_code ?? undefined,
					httpUrl: http.url ?? undefined,
					durationMs: Math.round((durationNs / 1_000_000) * 100) / 100,
					timestamp: attrs.start_timestamp ?? 'desconhecido',
					traceUrl: `https://app.${this.site}/apm/trace/${attrs.trace_id}?spanID=${attrs.span_id}`,
				};
			}),
		);

		this.apmTracesCache.set(cacheKey, traces);
		return traces;
	}
}
