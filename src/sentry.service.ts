import {
	SentryIssue,
	SentryIssueDetails,
	sentryIssueDetailsSchema,
	sentryIssueSchema,
} from './sentry.schema';

export class SentryService {
	private readonly authToken: string;
	private readonly organizationSlug: string;

	// implementação do cache - prteção contra a IA

	private detailsCache: Map<string, { data: SentryIssueDetails; expiresAt: number }> = new Map();
	private readonly CACHE_TTL_MS = 60000;

	constructor() {
		const token = process.env.SENTRY_AUTH_TOKEN;
		const org = process.env.SENTRY_ORG_SLUG;

		if (!token || !org) {
			throw new Error('Variávei de ambiente SENTRY_AUTH_TOKEN e SENTRY_ORG_SLUG são obrigatórias');
		}

		this.authToken = token;
		this.organizationSlug = org;
	}

	// requisição para buscar os erros em lista - Array sem cache para pegar os erros em tempo real.
	public async fetchRecentIssues(
		projectSlug: string,
		environment: string,
		limit: number = 5,
	): Promise<SentryIssue[]> {
		const url = `https://sentry.io/api/0/projects/${this.organizationSlug}/${projectSlug}/issues/?query=is:unresolved+environment:${environment}&limit=${limit}`;

		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' },
		});

		if (!response.ok) throw new Error(`Falha na API: ${response.statusText}`);

		const data = await response.json();
		return data.map((issue: any) => ({
			id: issue.id,
			title: issue.title,
			culprit: issue.culprit || 'Desconhecido',
			count: parseInt(issue.count, 10),
			permalink: issue.permalink,
		}));
	}

	// Busca a Stack Trace de um erro específico (COM CACHE)
	public async fetchIssueDetails(issueId: string): Promise<SentryIssueDetails> {
		const now = Date.now();
		const cachedItem = this.detailsCache.get(issueId);

		// 1. Verifica se temos no Cache e se ainda é válido (Rate Limiting Protection)
		if (cachedItem && cachedItem.expiresAt > now) {
			console.error(`[CACHE HIT] Retornando detalhes do erro ${issueId} da memória.`);
			return cachedItem.data;
		}

		// 2. Se não tem no cache, busca na internet
		console.error(`[CACHE MISS] Buscando erro ${issueId} na API do Sentry.`);
		const url = `https://sentry.io/api/0/issues/${issueId}/events/latest/`;
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' },
		});

		if (!response.ok) throw new Error(`Falha na API: ${response.statusText}`);

		const data = await response.json();
		const frames =
			data.entries?.find((e: any) => e.type === 'exception')?.data?.values?.[0]?.stacktrace?.frames ||
			[];
		let stackTraceLines: string[] = frames.map((f: any) => `File: ${f.filename} (Line ${f.lineNo})`);

		// Truncamento (Protegendo os tokens do LLM)
		if (stackTraceLines.length > 15) {
			stackTraceLines = stackTraceLines.slice(-15);
			stackTraceLines.unshift('... [STACK TRACE TRUNCADA] ...');
		}

		const result: SentryIssueDetails = {
			id: data.id,
			errorMessage: data.metadata?.value || data.title || 'Erro desconhecido',
			stackTrace: stackTraceLines,
			tags: data.tags?.reduce((acc: any, tag: any) => ({ ...acc, [tag.key]: tag.value }), {}) || {},
		};

		// 3. Salva no Cache para as próximas chamadas da IA
		this.detailsCache.set(issueId, { data: result, expiresAt: now + this.CACHE_TTL_MS });

		return result;
	}
}
