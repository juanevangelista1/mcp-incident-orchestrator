import { google } from '@ai-sdk/google';
import { convertToModelMessages, stepCountIs, streamText, UIMessage } from 'ai';
import { loadMcpTools } from '@/lib/mcp-tools';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const { tools, close } = await loadMcpTools();

	const result = streamText({
		model: google(process.env.GEMINI_MODEL ?? 'gemini-flash-latest'),
		system:
			'Você é o assistente do L3 Incident Orchestrator. Use as tools disponíveis (Sentry, Datadog, Clarity) ' +
			'para responder sobre erros, logs e comportamento de usuários da aplicação monitorada. ' +
			'Sempre prefira chamar uma tool a adivinhar números. Responda em português.\n\n' +
			// Sem isso, o modelo tenta adivinhar o projectSlug (frontend, backend, app...) e toda
			// tool do Sentry falha — o projeto é fixo, configurado no servidor, não algo pra adivinhar.
			(PROJECT_SLUG
				? `O projectSlug do Sentry a usar em TODAS as tools do Sentry é sempre '${PROJECT_SLUG}' — nunca invente ou tente outro valor.`
				: 'Nenhum SENTRY_PROJECT_SLUG está configurado no servidor; avise o usuário se ele pedir dados do Sentry.'),
		messages: await convertToModelMessages(messages),
		tools,
		stopWhen: stepCountIs(5),
		onFinish: () => {
			close();
		},
	});

	return result.toUIMessageStreamResponse();
}
