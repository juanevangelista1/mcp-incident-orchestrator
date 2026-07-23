import {
	SentryIssue,
	SentryIssueDetails,
	SentryIssuesSummary,
	sentryIssueDetailsSchema,
	sentryIssueSchema,
} from './sentry.schema';
import { TtlCache } from './lib/ttl-cache';

export interface IssuesQueryParams {
	environment?: string;
	route?: string;
	startDate?: string;
	endDate?: string;
}

export class SentryService {
	private readonly authToken: string;
	private readonly organizationSlug: string;

	// Protege contra a IA repetindo a mesma consulta de detalhes em loop (rate limiting do Sentry).
	private readonly detailsCache = new TtlCache<SentryIssueDetails>(60_000);

	// Cache permanente: o ID numérico de um projeto no Sentry nunca muda depois de criado,
	// então não faz sentido esse valor expirar como o cache de detalhes de erro (TTL).
	private readonly projectIdCache: Map<string, number> = new Map();

	constructor() {
		const token = process.env.SENTRY_AUTH_TOKEN;
		const org = process.env.SENTRY_ORG_SLUG;

		if (!token || !org) {
			throw new Error('Variávei de ambiente SENTRY_AUTH_TOKEN e SENTRY_ORG_SLUG são obrigatórias');
		}

		this.authToken = token;
		this.organizationSlug = org;
	}

	// Centraliza a checagem de erro HTTP para as chamadas à API do Sentry.
	// 401/403 quase sempre significam "token sem os scopes certos", não um bug de código —
	// então damos essa dica em vez de só repassar o texto genérico do Sentry.
	private async assertOk(response: Response, context: string): Promise<void> {
		if (response.ok) return;

		if (response.status === 401 || response.status === 403) {
			throw new Error(
				`Falha ao ${context}: ${response.status} ${response.statusText}. ` +
					`O token do Sentry provavelmente não tem os scopes necessários (org:read, project:read, event:read). ` +
					`Gere um novo User Auth Token com esses escopos — scopes de um token existente não podem ser alterados.`,
			);
		}

		throw new Error(`Falha ao ${context}: ${response.status} ${response.statusText}`);
	}

	private authHeaders(): HeadersInit {
		return { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' };
	}

	// Montagem única da query de busca (sintaxe de search do Sentry), reaproveitada por
	// fetchRecentIssues, countIssues e (indiretamente) summarizeIssues. O wildcard `*` no `url`
	// permite buscar por um trecho da rota sem saber a URL inteira. O filtro de data usa
	// `firstSeen`, não `lastSeen`: queremos "erros que surgiram nesse período", que é o que
	// um filtro de data num dashboard de incidentes normalmente significa.
	//
	// Os tokens são unidos por espaço, não por "+": a query inteira passa por
	// encodeURIComponent (um "+" literal viraria %2B, que o Sentry decodifica de volta como
	// "+" dentro do valor — não como separador — e quebra o parser com 400 Bad Request).
	private buildIssuesQuery(params: IssuesQueryParams): string {
		const tokens = ['is:unresolved'];
		if (params.environment) {
			tokens.push(`environment:${params.environment}`);
		}
		if (params.route) {
			tokens.push(`url:*${params.route}*`);
		}
		if (params.startDate) {
			tokens.push(`firstSeen:>=${params.startDate}`);
		}
		if (params.endDate) {
			tokens.push(`firstSeen:<=${params.endDate}`);
		}
		return tokens.join(' ');
	}

	// requisição para buscar os erros em lista - Array sem cache para pegar os erros em tempo real.
	public async fetchRecentIssues(
		projectSlug: string,
		params: IssuesQueryParams,
		limit: number,
	): Promise<SentryIssue[]> {
		const query = this.buildIssuesQuery(params);

		// A query precisa ser URL-encoded: o wildcard "*" e caracteres com acento (ex: "visita")
		// quebrariam a URL se fossem colados sem escapar.
		const url = `https://sentry.io/api/0/projects/${this.organizationSlug}/${projectSlug}/issues/?query=${encodeURIComponent(query)}&limit=${limit}`;

		const response = await fetch(url, { headers: this.authHeaders() });
		await this.assertOk(response, `buscar os erros do projeto '${projectSlug}'`);

		const data = await response.json();

		// Fronteira da Anti-Corruption Layer: validamos contra o schema em vez de confiar
		// cegamente no shape do JSON. Se o Sentry mudar um campo, isso falha aqui, com uma
		// mensagem clara, em vez de propagar `undefined` silenciosamente para a IA.
		return sentryIssueSchema.array().parse(
			data.map((issue: any) => ({
				id: issue.id,
				title: issue.title,
				culprit: issue.culprit || 'Desconhecido',
				count: parseInt(issue.count, 10),
				permalink: issue.permalink,
			})),
		);
	}

	// Traduz o "nome amigável" do projeto (slug) para o ID numérico interno que a API de estatísticas exige.
	// Cache permanente: uma vez resolvido, o par slug -> id nunca precisa ser buscado de novo.
	private async resolveProjectId(projectSlug: string): Promise<number> {
		const cached = this.projectIdCache.get(projectSlug);
		if (cached !== undefined) return cached;

		const url = `https://sentry.io/api/0/projects/${this.organizationSlug}/${projectSlug}/`;
		const response = await fetch(url, { headers: this.authHeaders() });
		await this.assertOk(response, `resolver o projeto '${projectSlug}'`);

		const data = await response.json();
		const projectId = parseInt(data.id, 10);
		this.projectIdCache.set(projectSlug, projectId);
		return projectId;
	}

	// Quantidade de erros: usa o endpoint de estatísticas da organização (issues-count),
	// que devolve só um número, em vez de baixar a lista inteira de issues para contá-la no nosso lado.
	public async countIssues(projectSlug: string, params: IssuesQueryParams): Promise<number> {
		const projectId = await this.resolveProjectId(projectSlug);
		const query = this.buildIssuesQuery(params);

		const url = `https://sentry.io/api/0/organizations/${this.organizationSlug}/issues-count/?project=${projectId}&query=${encodeURIComponent(query)}`;
		const response = await fetch(url, { headers: this.authHeaders() });
		await this.assertOk(response, `contar os erros do projeto '${projectSlug}'`);

		const data = await response.json();
		return data[query] ?? 0;
	}

	// Resumo dos erros: NÃO faz uma nova chamada de rede. Reaproveita fetchRecentIssues
	// e apenas agrega (soma/ordena) o que já veio, evitando bater na API do Sentry duas vezes
	// para responder a uma pergunta que é só uma "leitura diferente" do mesmo dado.
	public async summarizeIssues(projectSlug: string, params: IssuesQueryParams): Promise<SentryIssuesSummary> {
		const issues = await this.fetchRecentIssues(projectSlug, params, 100);

		const totalOccurrences = issues.reduce((sum, issue) => sum + issue.count, 0);

		const topCulprits = [...issues]
			.sort((a, b) => b.count - a.count)
			.slice(0, 3)
			.map((issue) => ({ culprit: issue.culprit, count: issue.count }));

		return { totalIssues: issues.length, totalOccurrences, topCulprits };
	}

	// Busca a Stack Trace de um erro específico (COM CACHE)
	public async fetchIssueDetails(issueId: string): Promise<SentryIssueDetails> {
		const cached = this.detailsCache.get(issueId);
		if (cached) {
			console.error(`[CACHE HIT] Retornando detalhes do erro ${issueId} da memória.`);
			return cached;
		}

		console.error(`[CACHE MISS] Buscando erro ${issueId} na API do Sentry.`);
		const url = `https://sentry.io/api/0/issues/${issueId}/events/latest/`;
		const response = await fetch(url, { headers: this.authHeaders() });
		await this.assertOk(response, `buscar os detalhes do erro '${issueId}'`);

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

		const contexts = data.contexts || {};
		const geo = data.user?.geo;
		const requestEntry = data.entries?.find((e: any) => e.type === 'request')?.data;
		const requestHeaders: [string, string][] = requestEntry?.headers || [];
		const getHeader = (name: string) =>
			requestHeaders.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];

		const breadcrumbs = ((data.entries?.find((e: any) => e.type === 'breadcrumbs')?.data?.values ||
			[]) as any[])
			.slice(-15)
			.map((b) => ({
				timestamp: b.timestamp ?? 'desconhecido',
				category: b.category ?? 'desconhecido',
				level: b.level ?? 'info',
				description: describeBreadcrumb(b),
			}));

		const result = sentryIssueDetailsSchema.parse({
			id: data.id,
			errorMessage: data.metadata?.value || data.title || 'Erro desconhecido',
			stackTrace: stackTraceLines,
			tags: data.tags?.reduce((acc: any, tag: any) => ({ ...acc, [tag.key]: tag.value }), {}) || {},
			context: {
				browser: contexts.browser ? `${contexts.browser.name} ${contexts.browser.version}` : undefined,
				os: contexts.os ? `${contexts.os.name} ${contexts.os.version}` : undefined,
				device: contexts.device
					? [contexts.device.brand, contexts.device.family, contexts.device.model]
							.filter(Boolean)
							.join(' ')
					: undefined,
				locale: contexts.culture?.locale,
				timezone: contexts.culture?.timezone,
				location: geo ? [geo.city, geo.region, geo.country_code].filter(Boolean).join(', ') : undefined,
			},
			request: requestEntry
				? {
						url: requestEntry.url ?? undefined,
						method: requestEntry.method ?? undefined,
						userAgent: getHeader('User-Agent'),
						referer: getHeader('Referer'),
					}
				: undefined,
			breadcrumbs,
		});

		this.detailsCache.set(issueId, result);
		return result;
	}
}

// Cada categoria de breadcrumb do Sentry guarda os dados relevantes num formato diferente
// (fetch/xhr tem method+url+status, navigation tem from/to, console só tem message) — esta
// função centraliza a tradução para uma única linha legível, igual à coluna "Description"
// que a própria UI do Sentry mostra na timeline de breadcrumbs.
function describeBreadcrumb(breadcrumb: any): string {
	const data = breadcrumb.data || {};
	if (breadcrumb.category === 'navigation' && (data.from || data.to)) {
		return `${data.from ?? '?'} → ${data.to ?? '?'}`;
	}
	if (data.method && data.url) {
		return `${data.method} ${data.url}${data.status_code ? ` [${data.status_code}]` : ''}`;
	}
	return breadcrumb.message || breadcrumb.category || 'Evento sem descrição';
}
