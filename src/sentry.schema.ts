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
});

// 1. O que a IA pode nos enviar (Input)
export const fetchIssuesInputSchema = baseIssueQuerySchema.extend({
	limit: z.number().min(1).max(20).default(5),
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

export const sentryIssueDetailsSchema = z.object({
	id: z.string(),
	errorMessage: z.string(),
	stackTrace: z.array(z.string()),
	tags: z.record(z.string(), z.string()),
});

export const sentryIssuesSummarySchema = z.object({
	totalIssues: z.number(),
	totalOccurrences: z.number(),
	topCulprits: z.array(z.object({ culprit: z.string(), count: z.number() })),
});

// Inferência de tipos do TypeScript
export type SentryIssue = z.infer<typeof sentryIssueSchema>;
export type SentryIssueDetails = z.infer<typeof sentryIssueDetailsSchema>;
export type SentryIssuesSummary = z.infer<typeof sentryIssuesSummarySchema>;
