'use client';

import { ReportExportButton } from '@/components/report-export-button';
import { buildIssuesReport } from '@/lib/report-export/builders';
import type { SentryIssue } from '@/lib/mcp-types';
import type { RankedIssue, PageRankRow } from '@/lib/error-severity';

export function IssuesExport({
	issues,
	rankedIssues,
	pageRank,
	clarityScriptErrors,
	filters,
}: {
	issues: SentryIssue[];
	rankedIssues: RankedIssue[];
	pageRank: PageRankRow[];
	clarityScriptErrors: { url: string; count: number }[];
	filters: Record<string, string | undefined>;
}) {
	return (
		<ReportExportButton
			buildDocument={() => buildIssuesReport({ issues, rankedIssues, pageRank, clarityScriptErrors, filters })}
			filenameBase="issues-sentry"
		/>
	);
}
