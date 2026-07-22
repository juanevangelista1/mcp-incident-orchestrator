import { google } from '@ai-sdk/google';
import { convertToModelMessages, stepCountIs, streamText, UIMessage } from 'ai';
import { loadMcpTools } from '@/lib/mcp-tools';

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const { tools, close } = await loadMcpTools();

	const result = streamText({
		model: google(process.env.GEMINI_MODEL ?? 'gemini-flash-latest'),
		system:
			'Você é o assistente do L3 Incident Orchestrator. Use as tools disponíveis (Sentry, Datadog, Clarity) ' +
			'para responder sobre erros, logs e comportamento de usuários da aplicação monitorada. ' +
			'Sempre prefira chamar uma tool a adivinhar números. Responda em português.',
		messages: await convertToModelMessages(messages),
		tools,
		stopWhen: stepCountIs(5),
		onFinish: () => {
			close();
		},
	});

	return result.toUIMessageStreamResponse();
}
