import { NextResponse } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue } from '@/lib/mcp-types';
import { getClarityInsights, getGa4Summary } from '@/lib/mcp-summaries';
import { listDailyReports } from '@/db/client';
import { toDailyPoints, weeklyRollup, monthlyRollup } from '@/lib/trends';
import { detectScenario } from '@/lib/scenarios';
import { buildStaticAnswers } from '@/lib/chat-static-answers';

export const dynamic = 'force-dynamic';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

// Agrega dados JÁ existentes (mesmas chamadas cacheadas que /issues, /insights e /reports já
// fazem) e monta as 17 respostas determinísticas — nenhuma chamada ao Gemini aqui. Ver
// chat-static-answers.ts para a composição de cada resposta.
export async function GET() {
	const [issuesResult, clarity, ga4] = await Promise.all([
		callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', { projectSlug: PROJECT_SLUG, limit: 100 }).catch(
			() => ({ data: undefined }),
		),
		getClarityInsights(),
		getGa4Summary(),
	]);

	const sentryIssues = issuesResult.data?.issues ?? [];

	const points = toDailyPoints(listDailyReports());
	const weeks = weeklyRollup(points);
	const months = monthlyRollup(points);
	const lastDay = points.at(-1);
	const prevDay = points.at(-2);
	const scenario = lastDay ? detectScenario(lastDay, prevDay) : null;

	const answers = buildStaticAnswers({ sentryIssues, clarity, ga4, points, weeks, months, scenario });

	return NextResponse.json({ answers });
}
