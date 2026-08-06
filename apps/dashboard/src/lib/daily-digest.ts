import {
	getSentrySummary,
	getDatadogErrorSummary,
	getClarityInsights,
	getClarityRegionInsights,
	getClarityBookingInsights,
	getAwsSummary,
	getGa4Summary,
} from '@/lib/mcp-summaries';
import { generateWithFallback } from '@/lib/gemini';
import { insertDailyReport, listDailyReports } from '@/db/client';
import { NewDailyReport } from '@/db/schema';

// Monta um resumo simples e determinístico a partir dos números coletados — não depende
// de nenhuma IA, então o digest nunca falha só porque o Gemini está fora do ar/sem chave.
function buildFallbackSummary(data: {
	sentry: Awaited<ReturnType<typeof getSentrySummary>>;
	datadog: Awaited<ReturnType<typeof getDatadogErrorSummary>>;
	clarity: Awaited<ReturnType<typeof getClarityInsights>>;
	aws: Awaited<ReturnType<typeof getAwsSummary>>;
	ga4: Awaited<ReturnType<typeof getGa4Summary>>;
}): string {
	const parts: string[] = [];
	if (data.sentry) {
		parts.push(`${data.sentry.totalIssues} erro(s) não resolvidos no Sentry (${data.sentry.totalOccurrences} ocorrências)`);
	}
	if (data.datadog) {
		parts.push(`${data.datadog.totalIssues} issue(s) de erro no Datadog Error Tracking (${data.datadog.totalOccurrences} ocorrências)`);
	}
	if (data.aws) {
		parts.push(`${data.aws.totalEvents} evento(s) recentes no CloudWatch`);
	}
	if (data.clarity) {
		parts.push(`${data.clarity.totalSessions} sessão(ões) no Clarity (${data.clarity.rageClicks} rage clicks)`);
	}
	if (data.ga4) {
		parts.push(
			`${data.ga4.sessions} sessão(ões) no GA4` +
				(data.ga4.conversions !== null ? ` (${data.ga4.conversions} conversões reais)` : ''),
		);
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
			`(Sentry/Datadog/Clarity/GA4/AWS CloudWatch): ${JSON.stringify(raw)}`,
		fallback,
	});
}

// Extraída da rota HTTP (api/cron/daily-digest) pra ser reaproveitada também pelo scheduler
// local (instrumentation.ts) — mesma lógica, duas formas de disparar (Vercel Cron via HTTP,
// dev local via node-cron), sem duplicar nada.
export async function runDailyDigest(): Promise<{ report: NewDailyReport }> {
	const [sentry, datadog, clarity, clarityRegion, clarityBooking, aws, ga4] = await Promise.all([
		getSentrySummary(),
		getDatadogErrorSummary(),
		getClarityInsights(),
		// Chamada de dimensões extra (Device/OS/Country) do Clarity — só o digest faz essa
		// chamada (ver comentário em mcp-summaries.ts), nunca a navegação interativa.
		getClarityRegionInsights(),
		// Idem: chamada extra filtrada pela URL de agendamento, só pro digest, só se configurada.
		getClarityBookingInsights(),
		getAwsSummary(),
		getGa4Summary(),
	]);

	const raw = { sentry, datadog, clarity, clarityRegion, clarityBooking, aws, ga4 };
	const fallback = buildFallbackSummary({ sentry, datadog, clarity, aws, ga4 });
	const summary = await buildSummary(fallback, raw);

	const now = new Date();
	const report: NewDailyReport = {
		date: now.toISOString().slice(0, 10),
		summary,
		sentryCount: sentry?.totalIssues ?? 0,
		datadogCount: datadog?.totalOccurrences ?? null,
		claritySessions: clarity?.totalSessions ?? null,
		awsCount: aws?.totalEvents ?? null,
		rawData: JSON.stringify(raw),
		createdAt: now.toISOString(),
	};

	insertDailyReport(report);

	return { report };
}

// Usado pelo scheduler local (instrumentation.ts) pra decidir se já existe digest de hoje
// antes de disparar uma execução de catch-up — evita gastar cota do Clarity/GA4 de novo a
// cada restart do dev server.
export function hasTodaysDigest(): boolean {
	const today = new Date().toISOString().slice(0, 10);
	return listDailyReports().some((r) => r.date === today);
}
