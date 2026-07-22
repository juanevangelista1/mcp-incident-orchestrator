import { z } from 'zod';

// 1. O que a IA pode nos enviar (Input)
export const fetchIssuesInputSchema = z.object({
	projectSlug: z.string().describe("O nome do projeto no Sentry (ex: 'frontend-app')"),
	environment: z
		.string()
		.optional()
		.describe('Ambiente (ex: production, staging, development). Deixe vazio para todos.'),
	limit: z.number().min(1).max(20).default(5),
});

export const fetchIssueDetailsInputSchema = z.object({
	issueId: z.string().describe('O ID do erro retornado na busca anterior'),
});

// Input compartilhado pelos plugins de contagem e resumo (mesma "pergunta de negócio" que a listagem)
export const countIssuesInputSchema = z.object({
	projectSlug: z.string().describe("O nome do projeto no Sentry (ex: 'frontend-app')"),
	environment: z
		.string()
		.optional()
		.describe('Ambiente (ex: production, staging, development). Deixe vazio para todos.'),
});

export const summarizeIssuesInputSchema = countIssuesInputSchema;

// 2. O que nós devolvemos para a IA (Output limpo)
export const sentryIssueSchema = z.object({
	id: z.string(),
	title: z.string(),
	culprit: z.string().nullable(),
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
