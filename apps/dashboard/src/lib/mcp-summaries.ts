import { callMcpTool } from '@/lib/mcp-client';
import {
	ClarityInsights,
	ClarityRegionInsights,
	DatadogLogsSummary,
	SentryIssuesSummary,
	AwsLogsSummary,
	Ga4Summary,
} from '@/lib/mcp-types';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';
const BOOKING_URL_PATTERN = process.env.CLARITY_BOOKING_URL_PATTERN ?? '';

// Compartilhado entre a página Overview e o digest diário (cron). Cada fetcher engole seus
// próprios erros e devolve `null` — o motivo mais comum é um plugin opcional desligado no MCP
// server (ex: "Tool summarize_datadog_logs not found"), não um bug, então não deve derrubar
// quem chamou (nem a página via Promise.allSettled, nem o cron via Promise.all).
async function safeCall<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
	try {
		const { data } = await callMcpTool<T>(name, args);
		return data ?? null;
	} catch (error) {
		// console.warn, não console.error: o caso mais comum é um plugin opcional desligado
		// no MCP server (ver server-factory.ts), o que é esperado, não uma falha da página.
		console.warn(`[mcp-summaries] '${name}' indisponível: ${error instanceof Error ? error.message : error}`);
		return null;
	}
}

export function getSentrySummary(): Promise<SentryIssuesSummary | null> {
	return safeCall<SentryIssuesSummary>('summarize_sentry_issues', { projectSlug: PROJECT_SLUG });
}

export function getDatadogSummary(): Promise<DatadogLogsSummary | null> {
	return safeCall<DatadogLogsSummary>('summarize_datadog_logs', {});
}

export function getClarityInsights(): Promise<ClarityInsights | null> {
	return safeCall<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3 });
}

// Só o digest diário deve chamar isso (ver comentário na tool): soma à mesma cota de
// 10 requisições/dia do Clarity que `fetch_clarity_insights` já usa.
export function getClarityRegionInsights(): Promise<ClarityRegionInsights | null> {
	return safeCall<ClarityRegionInsights>('fetch_clarity_region_insights', { numOfDays: 3 });
}

export function getAwsSummary(): Promise<AwsLogsSummary | null> {
	return safeCall<AwsLogsSummary>('summarize_aws_logs', {});
}

// GA4: conversão REAL (evento específico, se configurado no mcp-server via
// GA4_CONVERSION_EVENT_NAME), ao lado do proxy de intenção que o Clarity já mede.
export function getGa4Summary(): Promise<Ga4Summary | null> {
	return safeCall<Ga4Summary>('fetch_ga4_summary', { numOfDays: 7 });
}

// Só chamado pelo digest diário (mesma razão de getClarityRegionInsights: soma à mesma cota
// de 10/dia do Clarity). Sem CLARITY_BOOKING_URL_PATTERN configurado, nem tenta — evita gastar
// cota numa chamada que voltaria vazia mesmo.
export function getClarityBookingInsights(): Promise<ClarityInsights | null> {
	if (!BOOKING_URL_PATTERN) return Promise.resolve(null);
	return safeCall<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3, url: BOOKING_URL_PATTERN });
}
