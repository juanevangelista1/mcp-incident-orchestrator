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
