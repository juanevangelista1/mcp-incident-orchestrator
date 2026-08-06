import { DatadogErrorIssue, datadogErrorIssueSchema } from './datadog.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

interface ErrorIssueQueryParams {
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
}
