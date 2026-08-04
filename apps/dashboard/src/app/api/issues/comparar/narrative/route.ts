import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getGeminiModel, isGeminiConfigured, isGeminiMocked } from '@/lib/gemini';
import { findUnverifiedNumbers } from '@/lib/verify-narrative';
import type { RouteComparisonSnapshot } from '@/lib/report-export/builders';

export const dynamic = 'force-dynamic';

// Investigação de UMA comparação entre duas rotas — mesma cadeia de 8 passos dos outros dois
// prompts narrativos (api/reports/narrative, api/issues/[id]/narrative), reaproveitando
// lib/gemini.ts (DRY). Recebe os snapshots que a própria página /issues/comparar já buscou
// (Sentry + Clarity + GA4 de cada rota) no corpo — nenhuma consulta nova aqui.
export async function POST(req: Request) {
	if (!isGeminiConfigured()) {
		return NextResponse.json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY não configurada no dashboard.' }, { status: 400 });
	}
	if (isGeminiMocked()) {
		return NextResponse.json({ error: 'GEMINI_MOCK está ativo — desative pra gerar uma comparação de verdade.' }, { status: 400 });
	}

	const { snapshotA, snapshotB }: { snapshotA: RouteComparisonSnapshot; snapshotB: RouteComparisonSnapshot } = await req.json();

	const summarize = (s: RouteComparisonSnapshot) => ({
		rota: s.route,
		issuesSentry: s.issues.length,
		ocorrenciasSentry: s.totalOccurrences,
		top5ErrosSentry: [...s.issues].sort((a, b) => b.count - a.count).slice(0, 5).map((i) => ({ titulo: i.title, ocorrencias: i.count })),
		clarity: s.clarity
			? {
					sessoes: s.clarity.totalSessions,
					rageClickPercent: s.clarity.rageClickPercent,
					deadClickPercent: s.clarity.deadClickPercent,
					scriptErrorPercent: s.clarity.scriptErrorPercent,
				}
			: null,
		ga4: s.ga4 ? { sessoes: s.ga4.sessions, usuarios: s.ga4.totalUsers, conversoes: s.ga4.conversions } : null,
	});

	const evidence = { rotaA: summarize(snapshotA), rotaB: summarize(snapshotB) };

	const prompt = `Você é um analista sênior de Web Analytics, Observability e investigação de
incidentes. Compare as duas rotas abaixo, em português, em markdown, seguindo EXATAMENTE esta
estrutura, uma seção para cada etapa:

## Sintoma
O que se observa de diferente entre as duas rotas (erros, comportamento, conversão).

## Evidência
Números concretos de cada rota, lado a lado (Sentry, Clarity, GA4 quando disponível).

## Hipótese
1-3 hipóteses técnicas plausíveis para a diferença observada, baseadas SOMENTE nos dados
fornecidos.

## Investigação
O que os dados disponíveis permitem checar (e o que NÃO permitem — seja explícito).

## Correlação
Cruze erros com sessões/conversão de cada rota. IMPORTANTE: a correlação aqui é sempre
agregada por rota/período — Sentry, Clarity e GA4 não compartilham ID de sessão/usuário entre
si, então nunca é possível afirmar que UMA sessão específica com erro deixou de converter.
Deixe isso explícito. Se GA4 estiver disponível, trate seus números como conversão REAL;
sessões do Clarity continuam sendo comportamento, não conversão.

## Causa provável
Nunca conclua de forma simplista (proibido: "a rota X tem mais erro logo converte menos").
Use um tom como um destes dois exemplos, adaptando aos números reais:
- COM evidência forte: "A rota X teve Z% mais ocorrências de erro que a rota Y, e também
  apresentou conversão (GA4) W% menor no mesmo período. Existem evidências de associação,
  mas não de causalidade direta por sessão."
- SEM evidência suficiente: "As rotas têm volumes de erro parecidos e a conversão (GA4) não
  varia de forma consistente com isso. Os dados disponíveis não sustentam a hipótese de que
  o erro seja o fator determinante nessa diferença."

## Impacto
Quantifique o alcance (ocorrências, % de sessões afetadas, conversões quando houver GA4).

## Ação recomendada
Ações concretas de curto prazo e o que monitorar daqui pra frente pra confirmar ou descartar
a hipótese.

Dados das duas rotas:
${JSON.stringify(evidence, null, 2)}`;

	try {
		const { text } = await generateText({ model: getGeminiModel(), prompt });
		const unverifiedNumbers = findUnverifiedNumbers(text, evidence);
		return NextResponse.json({ report: text, unverifiedNumbers });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha ao gerar comparação com o Gemini.' },
			{ status: 502 },
		);
	}
}
