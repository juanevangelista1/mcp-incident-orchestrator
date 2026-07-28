import { google } from '@ai-sdk/google';
import { convertToModelMessages, stepCountIs, streamText, UIMessage } from 'ai';
import { loadMcpTools } from '@/lib/mcp-tools';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';
const BOOKING_URL_PATTERN = process.env.CLARITY_BOOKING_URL_PATTERN ?? '';

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const { tools, close } = await loadMcpTools();

	// "Hoje" real, não a data de corte de treino do modelo — sem isso o Gemini já respondeu
	// perguntas com "23 de julho" assumindo o ano de corte dele (2024) em vez do ano corrente,
	// e toda busca no Sentry com esse filtro de data voltou vazia (confirmado ao vivo).
	const today = new Date().toISOString().slice(0, 10);

	const result = streamText({
		model: google(process.env.GEMINI_MODEL ?? 'gemini-flash-latest'),
		system:
			'Você é o assistente do L3 Incident Orchestrator. Use as tools disponíveis (Sentry, Datadog, Clarity) ' +
			'para responder sobre erros, logs e comportamento de usuários da aplicação monitorada. ' +
			'Sempre prefira chamar uma tool a adivinhar números. Responda em português.\n\n' +
			`A data de hoje é ${today} — use isso (não sua data de corte de treino) para calcular startDate/endDate quando o usuário mencionar uma data relativa ou um dia específico.\n\n` +
			// Sem isso, o modelo tenta adivinhar o projectSlug (frontend, backend, app...) e toda
			// tool do Sentry falha — o projeto é fixo, configurado no servidor, não algo pra adivinhar.
			(PROJECT_SLUG
				? `O projectSlug do Sentry a usar em TODAS as tools do Sentry é sempre '${PROJECT_SLUG}' — nunca invente ou tente outro valor.\n\n`
				: 'Nenhum SENTRY_PROJECT_SLUG está configurado no servidor; avise o usuário se ele pedir dados do Sentry.\n\n') +
			// Mesmo problema do projectSlug: o modelo não tem como adivinhar a URL real da página
			// de agendamento (já tentou "agendamento-visita" e não encontrou nada, porque a rota
			// real tem "-de-" no meio) — dar o valor configurado evita esse ciclo de tentativa e erro.
			(BOOKING_URL_PATTERN
				? `Quando o usuário perguntar sobre "agendamento"/"agendamento de visita", o trecho de URL real da página é '${BOOKING_URL_PATTERN}' — use um trecho dela (ex: a parte 'agendamento-de-visita') no filtro 'route' das tools do Sentry, em vez de adivinhar.\n\n`
				: '') +
			'Se a primeira busca não encontrar nada, tente de novo com um termo mais genérico (ex: sem o filtro de rota, ou um trecho menor da URL) antes de desistir. ' +
			'IMPORTANTE: depois de consultar as tools que precisar, você DEVE terminar sempre com uma resposta em texto para o usuário — nunca finalize a conversa só com chamadas de tool, mesmo que o resultado tenha sido vazio (nesse caso, diga isso explicitamente e explique o que foi tentado).',
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
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes('RESOURCE_EXHAUSTED') || message.includes('exceeded your current quota')) {
				return 'A cota gratuita diária do Gemini (20 requisições/dia) foi excedida. Tente novamente mais tarde ou amanhã, quando ela resetar.';
			}
			return 'Ocorreu um erro ao processar sua pergunta. Tente novamente.';
		},
	});
}
