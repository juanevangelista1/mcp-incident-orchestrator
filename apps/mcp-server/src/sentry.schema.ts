import { z } from 'zod';

// Campos compartilhados por todos os plugins que consultam issues (captura, contagem e resumo).
// O filtro `route` busca por trecho na URL/rota do erro (tag `url` do Sentry, com wildcard),
// então a IA pode perguntar "erros na tela de agendamento de visita" sem saber a URL exata.
const baseIssueQuerySchema = z.object({
	projectSlug: z.string().describe("O nome do projeto no Sentry (ex: 'frontend-app')"),
	environment: z
		.string()
		.optional()
		.describe('Ambiente (ex: production, staging, development). Deixe vazio para todos.'),
	route: z
		.string()
		.optional()
		.describe(
			"Filtra por um trecho da URL/rota onde o erro ocorreu (ex: 'agendamento-visita'). Busca parcial, não precisa ser a URL completa.",
		),
	startDate: z
		.string()
		.optional()
		.describe('Data inicial (formato AAAA-MM-DD) para filtrar erros vistos a partir dela. Deixe vazio para não filtrar por data.'),
	endDate: z
		.string()
		.optional()
		.describe('Data final (formato AAAA-MM-DD) para filtrar erros vistos até ela. Deixe vazio para usar o momento atual.'),
});

// 1. O que a IA pode nos enviar (Input)
export const fetchIssuesInputSchema = baseIssueQuerySchema.extend({
	// 100 é o teto real de página do endpoint de issues do Sentry — pedir mais que isso
	// exigiria paginação (cursor), que não faz sentido para o caso de uso atual (chat/dashboard).
	limit: z.number().min(1).max(100).default(5),
});

export const fetchIssueDetailsInputSchema = z.object({
	issueId: z.string().describe('O ID do erro retornado na busca anterior'),
});

// Input compartilhado pelos plugins de contagem e resumo (mesma "pergunta de negócio" que a listagem)
export const countIssuesInputSchema = baseIssueQuerySchema;

export const summarizeIssuesInputSchema = baseIssueQuerySchema;

// 2. O que nós devolvemos para a IA (Output limpo)
export const sentryIssueSchema = z.object({
	id: z.string(),
	title: z.string(),
	culprit: z.string(), // nunca é null: o service já substitui por 'Desconhecido' antes de chegar aqui
	count: z.number(),
	permalink: z.string().url(),
});

// Espelha o que a própria UI do Sentry mostra na tela de detalhe de um erro
// (Contexts/HTTP Request/Breadcrumbs), extraído de contexts/entries do evento bruto.
export const sentryIssueDetailsSchema = z.object({
	id: z.string(),
	errorMessage: z.string(),
	stackTrace: z.array(z.string()),
	tags: z.record(z.string(), z.string()),
	context: z.object({
		browser: z.string().optional(),
		os: z.string().optional(),
		device: z.string().optional(),
		locale: z.string().optional(),
		timezone: z.string().optional(),
		location: z.string().optional(),
	}),
	request: z
		.object({
			url: z.string().optional(),
			method: z.string().optional(),
			userAgent: z.string().optional(),
			referer: z.string().optional(),
		})
		.optional(),
	breadcrumbs: z.array(
		z.object({
			timestamp: z.string(),
			category: z.string(),
			level: z.string(),
			description: z.string(),
		}),
	),
});

export const sentryIssuesSummarySchema = z.object({
	totalIssues: z.number(),
	totalOccurrences: z.number(),
	topCulprits: z.array(z.object({ culprit: z.string(), count: z.number() })),
});

// Output estruturado das tools (para consumidores que não são LLM, como o dashboard).
// O texto em `content` continua servindo o chat; `structuredContent` usa esses schemas.
export const fetchIssuesOutputSchema = z.object({ issues: z.array(sentryIssueSchema) });
export const countIssuesOutputSchema = z.object({ total: z.number() });

// Inferência de tipos do TypeScript
export type SentryIssue = z.infer<typeof sentryIssueSchema>;
export type SentryIssueDetails = z.infer<typeof sentryIssueDetailsSchema>;
export type SentryIssuesSummary = z.infer<typeof sentryIssuesSummarySchema>;
