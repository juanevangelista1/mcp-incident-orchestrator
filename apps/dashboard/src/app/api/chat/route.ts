import { convertToModelMessages, stepCountIs, streamText, UIMessage } from 'ai';
import { loadMcpTools } from '@/lib/mcp-tools';
import { getGeminiModel, todayContextFragment, projectSlugFragment, bookingUrlFragment, isQuotaExceededError } from '@/lib/gemini';

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const { tools, close } = await loadMcpTools();

	const system = [
		'Você é o assistente do L3 Incident Orchestrator. Use as tools disponíveis (Sentry, Datadog) ' +
			'para responder sobre erros e logs da aplicação monitorada. ' +
			'Sempre prefira chamar uma tool a adivinhar números. Responda em português.',
		// Sem cache de sessão/conversa, o chat não tem como saber se já gastou cota do Clarity
		// hoje — cada combinação de filtro que o Gemini decidisse tentar seria uma cota nova
		// (limite: 10/dia), sem nenhum controle sobre o padrão de chamada. Por isso essas tools
		// nem são passadas pro modelo (ver EXCLUDED_FROM_CHAT em lib/mcp-tools.ts); sessões,
		// páginas mais acessadas, rage/dead clicks e o funil de agendamento têm páginas
		// dedicadas com cache e opções fixas de filtro.
		'Você NÃO tem acesso a tools do Microsoft Clarity (sessões, páginas mais acessadas, rage/dead clicks, ' +
			'funil de agendamento). Se o usuário perguntar sobre isso, explique que essa cota é limitada e ' +
			'direcione para as páginas /insights (visão geral do Clarity) e /reports (comparativos diário/semanal/mensal ' +
			'e o cenário detectado) em vez de tentar responder sem dado.',
		todayContextFragment(),
		projectSlugFragment(),
		bookingUrlFragment(),
		'Se a primeira busca não encontrar nada, tente de novo com um termo mais genérico (ex: sem o filtro de rota, ou um trecho menor da URL) antes de desistir. ' +
			'IMPORTANTE: depois de consultar as tools que precisar, você DEVE terminar sempre com uma resposta em texto para o usuário — nunca finalize a conversa só com chamadas de tool, mesmo que o resultado tenha sido vazio (nesse caso, diga isso explicitamente e explique o que foi tentado).',
	]
		.filter(Boolean)
		.join('\n\n');

	const result = streamText({
		model: getGeminiModel(),
		system,
		messages: await convertToModelMessages(messages),
		tools,
		stopWhen: stepCountIs(8),
		onFinish: () => {
			close();
		},
		onError: (error) => {
			console.error('[chat] Erro no streamText:', error);
		},
	});

	return result.toUIMessageStreamResponse({
		// Por padrão o AI SDK esconde a mensagem real do erro do cliente (só manda "An error
		// occurred.") por segurança — mas isso deixou o chat parecendo travado sem explicação
		// quando a cota gratuita do Gemini (20 requisições/dia) estourou. Aqui só destravamos
		// uma mensagem específica e já conhecida (cota excedida); qualquer outro erro continua
		// genérico, sem vazar detalhe interno.
		onError: (error) => {
			if (isQuotaExceededError(error)) {
				return 'A cota gratuita diária do Gemini (20 requisições/dia) foi excedida. Tente novamente mais tarde ou amanhã, quando ela resetar.';
			}
			return 'Ocorreu um erro ao processar sua pergunta. Tente novamente.';
		},
	});
}
