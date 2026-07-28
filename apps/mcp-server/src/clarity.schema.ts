import { z } from 'zod';

// A API pública do Clarity ("Data Export API") só aceita 1 a 3 dias de janela —
// diferente do Sentry/Datadog, não dá pra pedir mais histórico que isso.
export const fetchClarityInsightsInputSchema = z.object({
	numOfDays: z
		.number()
		.min(1)
		.max(3)
		.default(3)
		.describe('Janela de dias para os insights (a API pública do Clarity só permite 1 a 3 dias).'),
	url: z
		.string()
		.optional()
		.describe('Filtra os insights por uma URL/rota específica do site.'),
});

// Output limpo. Diferente do Sentry/Datadog, o Clarity já devolve dados agregados —
// não existe "um evento específico" para expor id/detalhes sob demanda aqui.
export const clarityInsightsSchema = z.object({
	totalSessions: z.number(),
	rageClicks: z.number(),
	deadClicks: z.number(),
	scriptErrors: z.number(),
	topPages: z.array(z.object({ url: z.string(), sessions: z.number() })),
	// Detalhamentos (subtipos): em quais páginas cada tipo de clique problemático mais
	// acontece, e como as sessões se distribuem por dispositivo/navegador.
	rageClicksByPage: z.array(z.object({ url: z.string(), count: z.number() })),
	deadClicksByPage: z.array(z.object({ url: z.string(), count: z.number() })),
	scriptErrorsByPage: z.array(z.object({ url: z.string(), count: z.number() })),
	sessionsByDevice: z.array(z.object({ device: z.string(), count: z.number() })),
	sessionsByBrowser: z.array(z.object({ browser: z.string(), count: z.number() })),
	// Estimativa (não é um dado oficial do Clarity — a API não expõe detecção de bot):
	// sessões cujo recorte teve tempo ativo zerado no EngagementTime.
	lowEngagementSessions: z.number(),
});

export type ClarityInsights = z.infer<typeof clarityInsightsSchema>;

// Segunda chamada, separada da principal (dims diferentes: Device/OS/Country em vez de
// Url/Device/Browser). Chamada só 1x/dia pelo digest — nunca pela navegação interativa do
// dashboard — para não competir com a cota de 10 requisições/dia do Clarity.
export const fetchClarityRegionInsightsInputSchema = z.object({
	numOfDays: z
		.number()
		.min(1)
		.max(3)
		.default(3)
		.describe('Janela de dias (a API pública do Clarity só permite 1 a 3 dias).'),
});

export const clarityRegionInsightsSchema = z.object({
	sessionsByOS: z.array(z.object({ os: z.string(), count: z.number() })),
	sessionsByCountry: z.array(z.object({ country: z.string(), count: z.number() })),
});

export type ClarityRegionInsights = z.infer<typeof clarityRegionInsightsSchema>;
