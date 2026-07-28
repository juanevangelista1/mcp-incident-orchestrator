import { NextRequest, NextResponse } from 'next/server';
import {
	getSentrySummary,
	getDatadogSummary,
	getClarityInsights,
	getClarityRegionInsights,
	getClarityBookingInsights,
	getAwsSummary,
} from '@/lib/mcp-summaries';
import { generateWithFallback } from '@/lib/gemini';
import { insertDailyReport } from '@/db/client';

// Monta um resumo simples e determinístico a partir dos números coletados — não depende
// de nenhuma IA, então o digest nunca falha só porque o Gemini está fora do ar/sem chave.
function buildFallbackSummary(data: {
	sentry: Awaited<ReturnType<typeof getSentrySummary>>;
	datadog: Awaited<ReturnType<typeof getDatadogSummary>>;
	clarity: Awaited<ReturnType<typeof getClarityInsights>>;
	aws: Awaited<ReturnType<typeof getAwsSummary>>;
}): string {
	const parts: string[] = [];
	if (data.sentry) {
		parts.push(`${data.sentry.totalIssues} erro(s) não resolvidos no Sentry (${data.sentry.totalOccurrences} ocorrências)`);
	}
	if (data.datadog) {
		parts.push(`${data.datadog.totalLogs} log(s) recentes no Datadog`);
	}
	if (data.aws) {
		parts.push(`${data.aws.totalEvents} evento(s) recentes no CloudWatch`);
	}
	if (data.clarity) {
		parts.push(`${data.clarity.totalSessions} sessão(ões) no Clarity (${data.clarity.rageClicks} rage clicks)`);
	}
	return parts.length > 0 ? parts.join('; ') + '.' : 'Nenhuma fonte disponível para este digest.';
}

// Tenta enriquecer o resumo com o Gemini; generateWithFallback já cuida de cair de volta pro
// resumo determinístico se a chave não estiver configurada, GEMINI_MOCK estiver ativo ou a
// chamada falhar por qualquer motivo — o digest não pode depender de um serviço externo
// instável (e de cota limitada) para simplesmente registrar os números do dia.
function buildSummary(fallback: string, raw: Record<string, unknown>): Promise<string> {
	return generateWithFallback({
		prompt:
			'Resuma em até 3 frases, em português, o estado da aplicação hoje com base nestes dados ' +
			`(Sentry/Datadog/Clarity/AWS CloudWatch): ${JSON.stringify(raw)}`,
		fallback,
	});
}

export async function GET(req: NextRequest) {
	const authHeader = req.headers.get('authorization');
	if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const [sentry, datadog, clarity, clarityRegion, clarityBooking, aws] = await Promise.all([
		getSentrySummary(),
		getDatadogSummary(),
		getClarityInsights(),
		// Chamada de dimensões extra (Device/OS/Country) do Clarity — só o digest faz essa
		// chamada (ver comentário em mcp-summaries.ts), nunca a navegação interativa.
		getClarityRegionInsights(),
		// Idem: chamada extra filtrada pela URL de agendamento, só pro digest, só se configurada.
		getClarityBookingInsights(),
		getAwsSummary(),
	]);

	const raw = { sentry, datadog, clarity, clarityRegion, clarityBooking, aws };
	const fallback = buildFallbackSummary({ sentry, datadog, clarity, aws });
	const summary = await buildSummary(fallback, raw);

	const now = new Date();
	const report = {
		date: now.toISOString().slice(0, 10),
		summary,
		sentryCount: sentry?.totalIssues ?? 0,
		datadogCount: datadog?.totalLogs ?? null,
		claritySessions: clarity?.totalSessions ?? null,
		awsCount: aws?.totalEvents ?? null,
		rawData: JSON.stringify(raw),
		createdAt: now.toISOString(),
	};

	insertDailyReport(report);

	return NextResponse.json({ ok: true, report });
}
