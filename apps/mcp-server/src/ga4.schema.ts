import { z } from 'zod';

// GA4 Data API aceita qualquer janela de dias razoável (bem mais folgado que os 1-3 dias do
// Clarity) — 90 como teto só para evitar relatórios enormes por engano.
export const fetchGa4SummaryInputSchema = z.object({
	numOfDays: z
		.number()
		.min(1)
		.max(90)
		.default(7)
		.describe('Janela de dias para o resumo do GA4 (1 a 90).'),
});

// `conversions`/`conversionEventName` ficam `null` quando GA4_CONVERSION_EVENT_NAME não está
// configurado — não tentamos adivinhar um evento genérico ("key events"), só o evento
// específico que o usuário decidir monitorar (ex: agendamento_de_visita), para não confundir
// intenção (Clarity) com conversão real (GA4).
export const ga4SummarySchema = z.object({
	sessions: z.number(),
	totalUsers: z.number(),
	conversions: z.number().nullable(),
	conversionEventName: z.string().nullable(),
	topPagesBySessions: z.array(z.object({ page: z.string(), sessions: z.number() })),
	sessionsByDevice: z.array(z.object({ device: z.string(), sessions: z.number() })),
});

export type Ga4Summary = z.infer<typeof ga4SummarySchema>;
