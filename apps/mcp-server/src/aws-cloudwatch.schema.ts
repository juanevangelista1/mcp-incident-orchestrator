import { z } from 'zod';

// Mesmo papel do baseLogQuerySchema no Datadog: uma única "pergunta de negócio"
// reaproveitada pelos plugins de captura, contagem e resumo.
const baseAwsLogQuerySchema = z.object({
	logGroupName: z
		.string()
		.optional()
		.describe(
			'Nome do Log Group no CloudWatch (ex: "/aws/lambda/minha-funcao"). Se omitido, usa AWS_LOG_GROUP_NAME do servidor.',
		),
	filterPattern: z
		.string()
		.optional()
		.describe('Filter pattern do CloudWatch Logs (ex: "ERROR", "?ERROR ?Exception"). Deixe vazio para não filtrar.'),
	minutesAgo: z
		.number()
		.min(1)
		.max(1440)
		.default(15)
		.describe('Janela de tempo, em minutos, olhando para trás a partir de agora. Padrão: 15 minutos.'),
});

// 1. O que a IA pode nos enviar (Input)
export const fetchAwsLogsInputSchema = baseAwsLogQuerySchema.extend({
	limit: z.number().min(1).max(50).default(10).describe('Quantos eventos retornar (máximo 50).'),
});

export const countAwsLogsInputSchema = baseAwsLogQuerySchema;
export const summarizeAwsLogsInputSchema = baseAwsLogQuerySchema;

export const getAwsLogDetailsInputSchema = z.object({
	eventId: z.string().describe('O ID do evento retornado na busca anterior (campo "id").'),
});

// 2. O que devolvemos para a IA (Output limpo)
export const awsLogEntrySchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	logStreamName: z.string(),
	message: z.string(),
});

export const awsLogDetailsSchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	logStreamName: z.string(),
	message: z.string(),
	tags: z.record(z.string(), z.string()),
});

export const awsLogsSummarySchema = z.object({
	totalEvents: z.number(),
	byLogStream: z.array(z.object({ logStreamName: z.string(), count: z.number() })),
});

// Output estruturado das tools (para consumidores que não são LLM, como o dashboard).
export const fetchAwsLogsOutputSchema = z.object({ logs: z.array(awsLogEntrySchema) });
export const countAwsLogsOutputSchema = z.object({ total: z.number() });

export type AwsLogEntry = z.infer<typeof awsLogEntrySchema>;
export type AwsLogDetails = z.infer<typeof awsLogDetailsSchema>;
export type AwsLogsSummary = z.infer<typeof awsLogsSummarySchema>;
