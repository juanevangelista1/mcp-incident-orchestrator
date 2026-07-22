import { z } from 'zod';

// Campos compartilhados pelos plugins de captura, contagem e resumo — mesmo papel do
// baseIssueQuerySchema no Sentry: uma única "pergunta de negócio" reaproveitada em 3 lugares.
const baseLogQuerySchema = z.object({
	query: z
		.string()
		.optional()
		.describe("Texto livre de busca nos logs (ex: 'timeout'). Deixe vazio para não filtrar por texto."),
	service: z.string().optional().describe("Filtra pela tag 'service' (ex: 'payment-gateway')"),
	environment: z.string().optional().describe("Filtra pela tag 'env' (ex: 'production')"),
	minutesAgo: z
		.number()
		.min(1)
		.max(1440)
		.default(15)
		.describe('Janela de tempo, em minutos, olhando para trás a partir de agora. Padrão: 15 minutos.'),
});

// 1. O que a IA pode nos enviar (Input)
export const queryDatadogLogsInputSchema = baseLogQuerySchema.extend({
	limit: z.number().min(1).max(50).default(10).describe('Quantos logs retornar (máximo 50).'),
});

export const countDatadogLogsInputSchema = baseLogQuerySchema;
export const summarizeDatadogLogsInputSchema = baseLogQuerySchema;

export const getDatadogLogDetailsInputSchema = z.object({
	logId: z.string().describe('O ID do log retornado na busca anterior'),
});

// 2. O que devolvemos para a IA (Output limpo — o Datadog devolve um JSON bem mais verboso que isso)
export const datadogLogEntrySchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	service: z.string(),
	status: z.string(),
	message: z.string(),
	host: z.string(),
});

export const datadogLogDetailsSchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	service: z.string(),
	status: z.string(),
	message: z.string(),
	host: z.string(),
	tags: z.record(z.string(), z.string()),
});

export const datadogLogsSummarySchema = z.object({
	totalLogs: z.number(),
	byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
	byService: z.array(z.object({ service: z.string(), count: z.number() })),
});

// Output estruturado das tools (para consumidores que não são LLM, como o dashboard).
export const fetchLogsOutputSchema = z.object({ logs: z.array(datadogLogEntrySchema) });
export const countLogsOutputSchema = z.object({ total: z.number() });

export type DatadogLogEntry = z.infer<typeof datadogLogEntrySchema>;
export type DatadogLogDetails = z.infer<typeof datadogLogDetailsSchema>;
export type DatadogLogsSummary = z.infer<typeof datadogLogsSummarySchema>;
