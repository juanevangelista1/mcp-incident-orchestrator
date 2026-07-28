import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { listDailyReports } from '@/db/client';
import { toDailyPoints, baseline, percentChange } from '@/lib/trends';
import { detectScenario } from '@/lib/scenarios';

export const dynamic = 'force-dynamic';

// Retomando o pedido pendente de sessões anteriores (relatório narrativo no formato que o
// usuário colou como exemplo: causa provável + tabela quantitativa + matriz de confiança).
// Só agora faz sentido gerar isso: antes das Fases C-F não existia série histórica nem motor
// de cenários pra alimentar o prompt com evidência real, só teria gerado texto genérico.
export async function POST() {
	if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
		return NextResponse.json(
			{ error: 'GOOGLE_GENERATIVE_AI_API_KEY não configurada no dashboard.' },
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

	const prompt = `Você é um analista técnico de performance/produto. Com base nos dados agregados
abaixo (Sentry = erros de aplicação, Clarity = comportamento/sessões, "agendamento" = proxy de
intenção de conversão — sessões que chegaram na página de agendamento, NÃO confirmação de
conversão concluída), escreva um relatório curto em português, em markdown, com exatamente
estas seções:

## Causa provável
1-2 parágrafos. Baseie-se SOMENTE nos dados fornecidos. Se a evidência for insuficiente para
apontar uma causa, diga isso explicitamente em vez de especular.

## Resumo quantitativo
Uma tabela markdown com as métricas, dia atual, dia anterior e variação %.

## Matriz de confiança
Uma tabela markdown: Hipótese | Suportada por | Nível de confiança (Alta/Média/Baixa) | Ressalva.
Inclua sempre a ressalva de que a correlação é agregada por dia, não por sessão individual
(Sentry e Clarity não compartilham ID de sessão/usuário), e que "agendamento" é um proxy de
chegada na página, não confirmação de conversão.

Dados:
${JSON.stringify(evidence, null, 2)}`;

	try {
		const { text } = await generateText({
			model: google(process.env.GEMINI_MODEL ?? 'gemini-flash-latest'),
			prompt,
		});
		return NextResponse.json({ report: text });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha ao gerar relatório com o Gemini.' },
			{ status: 502 },
		);
	}
}
