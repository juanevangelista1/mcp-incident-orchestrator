import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { listDailyReports } from '@/db/client';
import { toDailyPoints, baseline, percentChange } from '@/lib/trends';
import { detectScenario } from '@/lib/scenarios';
import { getGeminiModel, isGeminiConfigured, isGeminiMocked } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

// Retomando o pedido pendente de sessões anteriores (relatório narrativo no formato que o
// usuário colou como exemplo: causa provável + tabela quantitativa + matriz de confiança).
// Só agora faz sentido gerar isso: antes das Fases C-F não existia série histórica nem motor
// de cenários pra alimentar o prompt com evidência real, só teria gerado texto genérico.
//
// Diferente do digest (que sempre cai num fallback silencioso via generateWithFallback), aqui
// o erro real precisa chegar ao usuário: é uma ação manual dele clicando em "gerar", não um job
// de fundo — esconder a falha deixaria o botão parecendo travado sem explicação.
export async function POST() {
	if (!isGeminiConfigured()) {
		return NextResponse.json(
			{ error: 'GOOGLE_GENERATIVE_AI_API_KEY não configurada no dashboard.' },
			{ status: 400 },
		);
	}
	if (isGeminiMocked()) {
		return NextResponse.json(
			{ error: 'GEMINI_MOCK está ativo — desative pra gerar um relatório de verdade.' },
			{ status: 400 },
		);
	}

	const points = toDailyPoints(listDailyReports());
	if (points.length === 0) {
		return NextResponse.json({ error: 'Nenhum digest gerado ainda — nada para analisar.' }, { status: 400 });
	}

	const lastDay = points.at(-1)!;
	const prevDay = points.at(-2);
	const scenario = detectScenario(lastDay, prevDay);

	const sessionsBaseline = baseline(points, 'claritySessions');
	const occurrencesBaseline = baseline(points, 'sentryOccurrences');
	const bookingBaseline = baseline(points, 'bookingArrivals');

	const evidence = {
		ultimoDia: lastDay,
		diaAnterior: prevDay ?? null,
		cenarioDetectado: scenario,
		variacaoDiaAnterior: {
			sessoes: percentChange(lastDay.claritySessions, prevDay?.claritySessions ?? null),
			erros: percentChange(lastDay.sentryOccurrences, prevDay?.sentryOccurrences ?? null),
			agendamento: percentChange(lastDay.bookingArrivals, prevDay?.bookingArrivals ?? null),
		},
		baseline: { sessoes: sessionsBaseline, erros: occurrencesBaseline, agendamento: bookingBaseline },
		diasDeHistorico: points.length,
	};

	const prompt = `Você é um analista sênior de Web Analytics, Product Analytics e Observability,
investigando a saúde da aplicação e do negócio no nível do PERÍODO (dia mais recente vs.
anterior), não de um erro específico. Dados: Sentry = erros de aplicação, Clarity =
comportamento/sessões, "agendamento" = proxy de intenção de conversão — sessões que chegaram
na página de agendamento, NÃO confirmação de conversão concluída.

Escreva em português, em markdown, seguindo EXATAMENTE esta estrutura, uma seção para cada
etapa:

## Sintoma
O que mudou no período mais recente (sessões, erros, chegadas em agendamento) — só os fatos
observados, sem interpretação ainda.

## Evidência
Tabela markdown com as métricas, dia atual, dia anterior e variação % (fórmula
((atual-anterior)/anterior)×100, já calculada nos dados abaixo). Inclua os valores de
baseline (média/maior/menor) pra contextualizar se o dia atual é normal ou atípico.

## Hipótese
1-3 hipóteses que os dados permitem levantar (ex: causa técnica, queda de tráfego,
comportamento sazonal) — sem escolher uma ainda.

## Investigação
O que os dados disponíveis permitem checar pra cada hipótese, e o que NÃO permitem (seja
explícito sobre os gaps — ex: sem GA4/CRM, sem funil completo de formulário).

## Correlação
Tabela markdown: Hipótese | Suportada por | Nível de confiança (Alta/Média/Baixa) | Ressalva.
Inclua sempre a ressalva de que a correlação é agregada por dia, não por sessão individual
(Sentry e Clarity não compartilham ID de sessão/usuário).

## Causa provável
Nunca conclua de forma simplista (proibido: "os agendamentos caíram por causa de erros").
Use um tom como um destes dois exemplos, adaptando aos números reais:
- COM evidência forte: "Entre os dias X e Y, os agendamentos caíram Z%, enquanto as sessões
  permaneceram estáveis. No mesmo período, o erro W aumentou V%, afetando principalmente
  [dispositivo/página]. Existem evidências de associação entre o erro e a queda de
  conversão."
- SEM evidência suficiente: "Os agendamentos caíram Z%, porém os erros permaneceram
  estáveis e a taxa de erro por sessão não aumentou. Ao mesmo tempo, [outro fator, ex:
  tráfego] caiu W%. Os dados disponíveis não sustentam a hipótese de que problemas técnicos
  sejam a causa principal."

## Impacto
Quantifique o alcance (variação %, quantos dias de histórico sustentam a conclusão).

## Ação recomendada
O que fazer agora e o que monitorar daqui pra frente pra confirmar ou descartar a hipótese.

Dados:
${JSON.stringify(evidence, null, 2)}`;

	try {
		const { text } = await generateText({ model: getGeminiModel(), prompt });
		return NextResponse.json({ report: text });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha ao gerar relatório com o Gemini.' },
			{ status: 502 },
		);
	}
}
