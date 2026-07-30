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
