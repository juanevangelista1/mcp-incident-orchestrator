'use client';

import { ReportExportButton } from '@/components/report-export-button';
import { buildRouteComparisonReport } from '@/lib/report-export/builders';
import type { ClarityInsights, SentryIssue } from '@/lib/mcp-types';

export function RouteComparisonExport({
	route,
	issues,
	totalOccurrences,
	clarity,
}: {
	route: string;
	issues: SentryIssue[];
	totalOccurrences: number;
	clarity: ClarityInsights | null;
}) {
	return (
		<ReportExportButton
			buildDocument={() => buildRouteComparisonReport({ route, issues, totalOccurrences, clarity })}
			filenameBase={`rota-${route.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
		/>
	);
}
