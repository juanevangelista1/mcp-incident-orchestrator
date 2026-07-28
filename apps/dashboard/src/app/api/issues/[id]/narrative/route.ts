import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue, SentryIssueDetails } from '@/lib/mcp-types';
import { classifySeverity } from '@/lib/error-severity';
import { listDailyReports } from '@/db/client';
import { toDailyPoints, percentChange } from '@/lib/trends';
import { detectScenario } from '@/lib/scenarios';
import { getGeminiModel, isGeminiConfigured, isGeminiMocked } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

// Investigação completa de UM erro — a peça que faltava: até aqui só existia o relatório
// narrativo do dia/período inteiro (api/reports/narrative). Reaproveita toda a evidência já
// calculada (severidade por percentil, série diária, cenário detectado) e pede ao Gemini pra
// seguir SEMPRE a cadeia Sintoma -> Evidência -> Hipótese -> Investigação -> Correlação ->
// Causa provável -> Impacto -> Ação recomendada — nunca uma conclusão simplista.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	if (!isGeminiConfigured()) {
		return NextResponse.json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY não configurada no dashboard.' }, { status: 400 });
	}
	if (isGeminiMocked()) {
		return NextResponse.json({ error: 'GEMINI_MOCK está ativo — desative pra gerar uma investigação de verdade.' }, { status: 400 });
	}

	const { id } = await params;

	const details = await callMcpTool<SentryIssueDetails>('get_sentry_issue_details', { issueId: id })
		.then((r) => r.data)
		.catch(() => undefined);
	if (!details) {
		return NextResponse.json({ error: 'Não foi possível carregar os detalhes desse erro.' }, { status: 404 });
	}

	// A lista de issues traz `count` e permite calcular severidade por percentil (não vem no
	// endpoint de detalhes) — mesma classificação já usada em /issues (error-severity.ts).
	const { data: listData } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
		projectSlug: PROJECT_SLUG,
		limit: 100,
	});
	const allIssues = listData?.issues ?? [];
	const ranked = classifySeverity(allIssues);
	const thisIssue = ranked.find((i) => i.id === id);

	// Contexto de período: mesma série diária/cenário que /reports já calcula. Correlação
	// aqui é SEMPRE por período (dia), nunca por evento individual — Sentry e Clarity não
	// compartilham ID de sessão/usuário, então não dá pra saber se ESTA sessão específica que
	// teve o erro também não converteu. O prompt abaixo deixa essa limitação explícita.
	const points = toDailyPoints(listDailyReports());
	const lastDay = points.at(-1);
	const prevDay = points.at(-2);
	const scenario = lastDay ? detectScenario(lastDay, prevDay) : null;

	const evidence = {
		erro: {
			mensagem: details.errorMessage,
			ocorrencias: thisIssue?.count ?? 'desconhecido',
			severidade: thisIssue?.severity ?? 'desconhecida (fora do top 100 issues atuais)',
			tags: details.tags,
			contexto: details.context,
			request: details.request,
		},
		periodoMaisRecente: {
			ultimoDia: lastDay ?? null,
			diaAnterior: prevDay ?? null,
			variacao: lastDay
				? {
						sessoes: percentChange(lastDay.claritySessions, prevDay?.claritySessions ?? null),
						errosGerais: percentChange(lastDay.sentryOccurrences, prevDay?.sentryOccurrences ?? null),
						agendamento: percentChange(lastDay.bookingArrivals, prevDay?.bookingArrivals ?? null),
					}
				: null,
			cenarioDetectado: scenario,
		},
	};

	const prompt = `Você é um analista sênior de Web Analytics, Observability e investigação de
incidentes. Escreva uma investigação completa deste erro específico, em português, em
markdown, seguindo EXATAMENTE esta estrutura, uma seção para cada etapa:

## Sintoma
O que o usuário/sistema observa (a partir da mensagem de erro e contexto).

## Evidência
Números concretos: ocorrências, severidade, tags, dispositivo/navegador/localização, e a
variação do período mais recente disponível (dado em "periodoMaisRecente" abaixo).

## Hipótese
1-3 hipóteses técnicas plausíveis para a causa raiz, baseadas SOMENTE na stack
trace/contexto/tags fornecidos.

## Investigação
O que os dados disponíveis permitem checar (e o que NÃO permitem — seja explícito sobre
isso).

## Correlação
Cruze com o cenário/variação do período mais recente. IMPORTANTE: a correlação aqui é
sempre agregada por dia/período — Sentry e Clarity não compartilham ID de sessão/usuário,
então nunca é possível afirmar que UMA sessão específica com este erro deixou de converter.
Deixe isso explícito.

## Causa provável
Nunca conclua de forma simplista (proibido: "os agendamentos caíram por causa deste erro").
Use um tom como um destes dois exemplos, adaptando aos números reais:
- COM evidência forte: "Entre os dias X e Y, [métrica] caiu Z%, enquanto [outra métrica]
  permaneceu estável. No mesmo período, este erro aumentou W%, afetando principalmente
  [dispositivo/página]. Existem evidências de associação, mas não de causalidade direta por
  sessão."
- SEM evidência suficiente: "[Métrica] caiu Z%, porém este erro permaneceu estável/não
  aumentou proporcionalmente. Os dados disponíveis não sustentam a hipótese de que este erro
  seja a causa principal."

## Impacto
Quantifique o alcance (ocorrências, % de sessões se houver dado do Clarity, severidade).

## Ação recomendada
Ações concretas de curto prazo (mitigar) e o que monitorar daqui pra frente pra confirmar ou
descartar a hipótese.

Dados disponíveis:
${JSON.stringify(evidence, null, 2)}

Stack trace (até 15 linhas, já truncada se necessário):
${details.stackTrace.join('\n')}`;

	try {
		const { text } = await generateText({ model: getGeminiModel(), prompt });
		return NextResponse.json({ report: text });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha ao gerar investigação com o Gemini.' },
			{ status: 502 },
		);
	}
}
