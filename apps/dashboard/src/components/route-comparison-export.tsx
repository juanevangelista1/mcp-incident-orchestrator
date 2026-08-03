'use client';

import { ReportExportButton } from '@/components/report-export-button';
import { buildRouteComparisonReport } from '@/lib/report-export/builders';
import type { ClarityInsights, Ga4Summary, SentryIssue } from '@/lib/mcp-types';

export function RouteComparisonExport({
	route,
	issues,
	totalOccurrences,
	clarity,
	ga4,
}: {
	route: string;
	issues: SentryIssue[];
	totalOccurrences: number;
	clarity: ClarityInsights | null;
	ga4: Ga4Summary | null;
}) {
	return (
		<ReportExportButton
			buildDocument={() => buildRouteComparisonReport({ route, issues, totalOccurrences, clarity, ga4 })}
			filenameBase={`rota-${route.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
		/>
	);
}
