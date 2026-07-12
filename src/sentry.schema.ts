import { z } from 'zod';

// 1. O que a IA pode nos enviar (Input)
export const fetchIssuesInputSchema = z.object({
	projectSlug: z.string().describe("O nome do projeto no Sentry (ex: 'frontend-app')"),
	environment: z.enum(['production', 'staging']).default('production'),
	limit: z.number().min(1).max(20).default(5),
});

export const fetchIssueDetailsInputSchema = z.object({
	issueId: z.string().describe('O ID do erro retornado na busca anterior'),
});

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

// Inferência de tipos do TypeScript
export type SentryIssue = z.infer<typeof sentryIssueSchema>;
export type SentryIssueDetails = z.infer<typeof sentryIssueDetailsSchema>;
