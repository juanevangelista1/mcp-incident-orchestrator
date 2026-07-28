import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// Único lugar que resolve o modelo/chave do Gemini — antes cada rota (daily-digest,
// narrative-report, chat) repetia `google(process.env.GEMINI_MODEL ?? 'gemini-flash-latest')`
// e checava a env var à sua própria maneira. Qualquer troca de modelo ou de estratégia de
// fallback agora muda em um lugar só.
const MODEL_ID = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

export function isGeminiConfigured(): boolean {
	return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

export function getGeminiModel() {
	return google(MODEL_ID);
}

// GEMINI_MOCK=true pula a chamada real e devolve o fallback na hora — existe pra testar/
// desenvolver as rotas que usam Gemini (digest, relatório narrativo) sem gastar a cota
// gratuita de 20 requisições/dia, que já estourou mais de uma vez só com teste manual.
export function isGeminiMocked(): boolean {
	return process.env.GEMINI_MOCK === 'true';
}

// Fragmentos de system prompt reaproveitáveis entre rotas que usam tools (hoje só o chat,
// mas evita duplicar essa lógica se uma segunda rota precisar do mesmo contexto amanhã).
// Cada um existe porque um valor específico já causou o modelo alucinar/errar sem ele
// (ver histórico: projectSlug errado, data calculada com ano de corte do treino, URL de
// agendamento chutada).
export function todayContextFragment(): string {
	const today = new Date().toISOString().slice(0, 10);
	return `A data de hoje é ${today} — use isso (não sua data de corte de treino) para calcular startDate/endDate quando o usuário mencionar uma data relativa ou um dia específico.`;
}

export function projectSlugFragment(): string {
	const slug = process.env.SENTRY_PROJECT_SLUG;
	return slug
		? `O projectSlug do Sentry a usar em TODAS as tools do Sentry é sempre '${slug}' — nunca invente ou tente outro valor.`
		: 'Nenhum SENTRY_PROJECT_SLUG está configurado no servidor; avise o usuário se ele pedir dados do Sentry.';
}

export function bookingUrlFragment(): string {
	const pattern = process.env.CLARITY_BOOKING_URL_PATTERN;
	if (!pattern) return '';
	return `Quando o usuário perguntar sobre "agendamento"/"agendamento de visita", o trecho de URL real da página é '${pattern}' — use um trecho dela (ex: a parte 'agendamento-de-visita') no filtro 'route' das tools do Sentry, em vez de adivinhar.`;
}

// Detecta o erro específico de cota gratuita excedida (429 RESOURCE_EXHAUSTED) — usado tanto
// pelo chat (pra dar uma mensagem clara ao usuário) quanto em qualquer rota futura que precise
// distinguir "sem cota hoje" de "erro genérico", sem duplicar essa checagem de string.
export function isQuotaExceededError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes('RESOURCE_EXHAUSTED') || message.includes('exceeded your current quota');
}

// Ponto único de chamada pra geração "de um tiro só" (sem tools, sem multi-step) — usado por
// daily-digest e narrative-report. Sempre cai no `fallback` se o Gemini não estiver
// configurado, estiver mockado (GEMINI_MOCK=true) ou a chamada falhar por qualquer motivo
// (cota excedida, rede, etc.) — essas rotas nunca podem quebrar só porque um serviço externo
// e opcional está indisponível.
export async function generateWithFallback(params: { prompt: string; fallback: string }): Promise<string> {
	if (!isGeminiConfigured() || isGeminiMocked()) return params.fallback;

	try {
		const { text } = await generateText({ model: getGeminiModel(), prompt: params.prompt });
		return text || params.fallback;
	} catch (error) {
		console.error('[gemini] Falha ao gerar texto, usando fallback:', error);
		return params.fallback;
	}
}
