import { z } from 'zod';

// GA4 Data API aceita qualquer janela de dias razoável (bem mais folgado que os 1-3 dias do
// Clarity) — 90 como teto só para evitar relatórios enormes por engano.
export const fetchGa4SummaryInputSchema = z.object({
	numOfDays: z
		.number()
		.min(1)
		.max(90)
		.default(7)
		.describe('Janela de dias para o resumo do GA4 (1 a 90) — ignorado se startDate/endDate forem informados.'),
	startDate: z
		.string()
		.optional()
		.describe('Data inicial (AAAA-MM-DD). Quando informada junto de endDate, substitui numOfDays.'),
	endDate: z
		.string()
		.optional()
		.describe('Data final (AAAA-MM-DD, inclusive). Quando informada junto de startDate, substitui numOfDays.'),
	pagePath: z
		.string()
		.optional()
		.describe('Filtra sessões/conversões por um trecho da URL/rota (busca parcial, ex: "/imovel/").'),
	device: z
		.string()
		.optional()
		.describe(
			'Filtra sessões por categoria de dispositivo do GA4 (busca parcial, case-insensitive — ex: "mobile", "desktop", "tablet").',
		),
	eventName: z
		.string()
		.optional()
		.describe(
			'Filtra a contagem de eventos por um trecho do nome (busca parcial — ex: "visit_" pra ver só o funil de agendamento, que senão pode ficar fora do top 25 por volume junto de eventos genéricos como page_view/scroll).',
		),
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
	// Contagem de TODOS os eventos do GA4 (page_view, click, scroll, o evento de conversão
	// configurado, etc.) — não só o evento de conversão. É o que dá a "aba de eventos" que só
	// olhar `conversions` não responde: quais eventos disparam mais, não só se converteu.
	eventsByName: z.array(z.object({ eventName: z.string(), count: z.number() })),
});

export type Ga4Summary = z.infer<typeof ga4SummarySchema>;
