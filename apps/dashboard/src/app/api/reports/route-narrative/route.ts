import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getGeminiModel, isGeminiConfigured, isGeminiMocked } from '@/lib/gemini';
import { findUnverifiedNumbers } from '@/lib/verify-narrative';
import { upsertNarrative } from '@/db/client';
import type { RouteSnapshot } from '@/lib/route-snapshot';

export const dynamic = 'force-dynamic';

// Diagnóstico de UMA rota (não comparação, não histórico agregado) — mesma cadeia de 8 passos
// dos outros três prompts narrativos (api/reports/narrative, api/issues/[id]/narrative,
// api/issues/comparar/narrative), reaproveitando lib/gemini.ts (DRY). Recebe o snapshot que a
// própria página /reports já buscou (Sentry + Clarity + GA4 + Datadog da rota) no corpo, mais
// o baseline global (já calculado na página a partir do digest histórico) pra contextualizar
// discrepância — nenhuma consulta nova aqui.
export async function POST(req: Request) {
	if (!isGeminiConfigured()) {
		return NextResponse.json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY não configurada no dashboard.' }, { status: 400 });
	}
	if (isGeminiMocked()) {
		return NextResponse.json({ error: 'GEMINI_MOCK está ativo: desative pra gerar um diagnóstico de verdade.' }, { status: 400 });
	}

	const {
		snapshot,
		from,
		to,
		baseline,
	}: {
		snapshot: RouteSnapshot;
		from: string;
		to: string;
		baseline: { ocorrenciasSentryMedia: number | null; conversoesGa4Media: number | null };
	} = await req.json();

	const evidence = {
		rota: snapshot.route,
		periodo: { de: from, ate: to },
		sentry: {
			totalIssues: snapshot.issues.length,
			totalOcorrencias: snapshot.totalOccurrences,
			top5Erros: [...snapshot.issues].sort((a, b) => b.count - a.count).slice(0, 5).map((i) => ({ titulo: i.title, ocorrencias: i.count })),
			erro: snapshot.sentryError,
		},
		datadog: snapshot.datadogError
			? { erro: snapshot.datadogError }
			: {
					totalIssues: snapshot.datadogIssues.length,
					top5Erros: [...snapshot.datadogIssues].sort((a, b) => b.totalCount - a.totalCount).slice(0, 5).map((i) => ({
						servico: i.service,
						erro: `${i.errorType}: ${i.errorMessage}`,
						ocorrencias: i.totalCount,
					})),
				},
		clarity: snapshot.clarity
			? {
					sessoes: snapshot.clarity.totalSessions,
					rageClickPercent: snapshot.clarity.rageClickPercent,
					deadClickPercent: snapshot.clarity.deadClickPercent,
					scriptErrorPercent: snapshot.clarity.scriptErrorPercent,
				}
			: { erro: snapshot.clarityError },
		ga4: snapshot.ga4
			? { sessoes: snapshot.ga4.sessions, usuarios: snapshot.ga4.totalUsers, conversoes: snapshot.ga4.conversions }
			: { erro: snapshot.ga4Error },
		baselineGlobal: baseline,
	};

	const prompt = `Você é um analista sênior de Web Analytics, Observability e investigação de
incidentes. Analise a rota abaixo, em português, em markdown, seguindo EXATAMENTE esta
estrutura, uma seção para cada etapa:

## Sintoma
O que se observa nos números desta rota no período (erros, comportamento, conversão).

## Evidência
Números concretos (Sentry, Datadog, Clarity, GA4 quando disponíveis). Se alguma fonte estiver
indisponível ou com erro, diga isso explicitamente em vez de inventar um número.

## Hipótese
1-3 hipóteses técnicas plausíveis para o que se observa, baseadas SOMENTE nos dados fornecidos.

## Investigação
O que os dados disponíveis permitem checar (e o que NÃO permitem — seja explícito).

## Correlação
Cruze erros (Sentry/Datadog) com comportamento (Clarity) e conversão (GA4). IMPORTANTE: a
correlação aqui é sempre agregada por rota/período — Sentry, Datadog, Clarity e GA4 não
compartilham ID de sessão/usuário entre si, então nunca é possível afirmar que UMA sessão
específica com erro deixou de converter. Deixe isso explícito. Trate os números de GA4 como
conversão REAL; sessões do Clarity continuam sendo comportamento, não conversão.

## Causa provável
Nunca conclua de forma simplista (proibido: "a rota tem erro logo converte menos"). Use um tom
como um destes dois exemplos, adaptando aos números reais:
- COM evidência forte: "A rota teve Z ocorrências de erro no período, acima da média global de
  W, e a conversão (GA4) caiu em relação ao baseline. Existem evidências de associação, mas não
  de causalidade direta por sessão."
- SEM evidência suficiente: "O volume de erro está dentro do esperado (baseline) e a conversão
  (GA4) não varia de forma consistente com isso. Os dados disponíveis não sustentam a hipótese
  de que haja um problema relevante nesta rota."

## Impacto
Quantifique o alcance (ocorrências, % de sessões afetadas, conversões quando houver GA4).

## Ação recomendada
Ações concretas de curto prazo e o que monitorar daqui pra frente pra confirmar ou descartar
a hipótese.

Dados da rota:
${JSON.stringify(evidence, null, 2)}`;

	try {
		const { text } = await generateText({ model: getGeminiModel(), prompt });
		const unverifiedNumbers = findUnverifiedNumbers(text, evidence);
		upsertNarrative({
			kind: 'route_report',
			key: `${snapshot.route}|${from}|${to}`,
			narrative: text,
			unverifiedNumbers,
		});
		return NextResponse.json({ report: text, unverifiedNumbers });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha ao gerar diagnóstico com o Gemini.' },
			{ status: 502 },
		);
	}
}
