import { z } from 'zod';

// Error Tracking é o único produto Datadog integrado aqui — Logs não é usado porque a conta
// não tem nenhum log source configurado no onboarding do Datadog (Logs sempre voltava vazio).
// Reaproveita DATADOG_API_KEY/DATADOG_APP_KEY, não precisa de configuração própria.
export const queryDatadogErrorIssuesInputSchema = z.object({
	query: z
		.string()
		.optional()
		.describe("Texto livre no formato de busca do Datadog (ex: 'service:lello-web env:production'). Deixe vazio para não filtrar."),
	minutesAgo: z
		.number()
		.min(1)
		.max(10080)
		.default(1440)
		.describe('Janela de tempo, em minutos, olhando para trás a partir de agora. Padrão: 24h.'),
	limit: z.number().min(1).max(50).default(20).describe('Quantas issues retornar (máximo 50), ordenadas por volume.'),
});

export const datadogErrorIssueSchema = z.object({
	id: z.string(),
	errorMessage: z.string(),
	errorType: z.string(),
	service: z.string(),
	platform: z.string(),
	state: z.string(),
	isCrash: z.boolean(),
	firstSeen: z.string(),
	lastSeen: z.string(),
	totalCount: z.number(),
});

export const fetchErrorIssuesOutputSchema = z.object({ issues: z.array(datadogErrorIssueSchema) });

export type DatadogErrorIssue = z.infer<typeof datadogErrorIssueSchema>;

export const getDatadogErrorIssueDetailsInputSchema = z.object({
	issueId: z.string().describe('O ID da issue retornado na busca anterior (fetch_datadog_error_issues).'),
});

// Superset de datadogErrorIssueSchema, MENOS totalCount: o endpoint GET /issues/{id} do
// Datadog devolve o objeto Issue puro, que não carrega a contagem (isso só existe no
// resultado agregado da busca) — por isso field próprio, não `.extend()` do schema de lista.
export const datadogErrorIssueDetailsSchema = z.object({
	id: z.string(),
	errorMessage: z.string(),
	errorType: z.string(),
	service: z.string(),
	platform: z.string(),
	state: z.string(),
	isCrash: z.boolean(),
	firstSeen: z.string(),
	lastSeen: z.string(),
	filePath: z.string().optional(),
	functionName: z.string().optional(),
	languages: z.array(z.string()),
	firstSeenVersion: z.string().optional(),
	lastSeenVersion: z.string().optional(),
	regression: z
		.object({
			regressedAt: z.string(),
			resolvedAt: z.string(),
		})
		.optional(),
});

export type DatadogErrorIssueDetails = z.infer<typeof datadogErrorIssueDetailsSchema>;

// APM Traces/Spans: produto diferente de Error Tracking (endpoint /api/v2/spans, não
// /api/v2/error-tracking) — Error Tracking agrupa erros em issues "de negócio"; Spans mostra
// a chamada individual (serviço → serviço, HTTP, duração) onde o erro aconteceu, útil pra ver
// o request específico por trás de uma issue. Mesma credencial (DATADOG_API_KEY/APP_KEY).
export const queryDatadogApmTracesInputSchema = z.object({
	query: z
		.string()
		.optional()
		.describe(
			"Texto livre no formato de busca de spans do Datadog (ex: 'env:production service:api'), combinado com 'status:error'. Deixe vazio para ver erros de todos os serviços/ambientes.",
		),
	minutesAgo: z
		.number()
		.min(1)
		.max(10080)
		.default(1440)
		.describe('Janela de tempo, em minutos, olhando para trás a partir de agora. Padrão: 24h.'),
	limit: z.number().min(1).max(50).default(20).describe('Quantos spans retornar (máximo 50), mais recentes primeiro.'),
});

export const datadogApmTraceSchema = z.object({
	id: z.string(),
	traceId: z.string(),
	spanId: z.string(),
	service: z.string(),
	resourceName: z.string(),
	operationName: z.string(),
	status: z.string(),
	env: z.string(),
	httpMethod: z.string().optional(),
	httpStatusCode: z.string().optional(),
	httpUrl: z.string().optional(),
	durationMs: z.number(),
	timestamp: z.string(),
	// Link direto pro trace na UI do Datadog — montado no service (que conhece DATADOG_SITE),
	// o dashboard nunca precisa saber o site da conta pra montar essa URL.
	traceUrl: z.string(),
});

export const fetchApmTracesOutputSchema = z.object({ traces: z.array(datadogApmTraceSchema) });

export type DatadogApmTrace = z.infer<typeof datadogApmTraceSchema>;
