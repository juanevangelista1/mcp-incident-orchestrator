'use client';

import { ReportExportButton } from '@/components/report-export-button';
import { buildReportsReport } from '@/lib/report-export/builders';
import type { DailyPoint, RollupRow, Baseline } from '@/lib/trends';
import type { Scenario } from '@/lib/scenarios';

export function ReportsExport({
	points,
	weeks,
	months,
	sessionsBaseline,
	occurrencesBaseline,
	scenario,
}: {
	points: DailyPoint[];
	weeks: RollupRow[];
	months: RollupRow[];
	sessionsBaseline: Baseline | null;
	occurrencesBaseline: Baseline | null;
	scenario: Scenario | null;
}) {
	return (
		<ReportExportButton
			buildDocument={() =>
				buildReportsReport({ points, weeks, months, sessionsBaseline, occurrencesBaseline, scenario })
			}
			filenameBase="relatorio-comparativos"
		/>
	);
}
