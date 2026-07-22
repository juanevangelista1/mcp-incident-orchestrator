import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights, DatadogLogsSummary, SentryIssuesSummary, AwsLogsSummary } from '@/lib/mcp-types';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

// Compartilhado entre a página Overview e o digest diário (cron). Cada fetcher engole seus
// próprios erros e devolve `null` — o motivo mais comum é um plugin opcional desligado no MCP
// server (ex: "Tool summarize_datadog_logs not found"), não um bug, então não deve derrubar
// quem chamou (nem a página via Promise.allSettled, nem o cron via Promise.all).
async function safeCall<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
	try {
		const { data } = await callMcpTool<T>(name, args);
		return data ?? null;
	} catch (error) {
		console.error(`[mcp-summaries] '${name}' indisponível:`, error);
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

export function getAwsSummary(): Promise<AwsLogsSummary | null> {
	return safeCall<AwsLogsSummary>('summarize_aws_logs', {});
}
