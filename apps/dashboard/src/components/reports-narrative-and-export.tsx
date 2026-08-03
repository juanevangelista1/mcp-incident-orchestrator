'use client';

import { useState } from 'react';
import { NarrativeReport } from '@/components/narrative-report';
import { ReportExportButton } from '@/components/report-export-button';
import { buildReportsReport } from '@/lib/report-export/builders';
import type { DailyPoint, RollupRow, Baseline } from '@/lib/trends';
import type { Scenario } from '@/lib/scenarios';

// Junta o relatório narrativo (Gemini, sob demanda) com o botão de exportar num único
// componente cliente, porque os dois precisam compartilhar o texto gerado: sem isso, o PDF/
// Excel nunca incluía a cadeia Sintoma->Evidência->...->Ação, só os números (o texto ficava
// preso no estado local do NarrativeReport, que o botão de export não enxergava).
export function ReportsNarrativeAndExport({
	points,
	weeks,
	months,
	sessionsBaseline,
	occurrencesBaseline,
	bookingBaseline,
	ga4ConversionsBaseline,
	scenario,
}: {
	points: DailyPoint[];
	weeks: RollupRow[];
	months: RollupRow[];
	sessionsBaseline: Baseline | null;
	occurrencesBaseline: Baseline | null;
	bookingBaseline: Baseline | null;
	ga4ConversionsBaseline: Baseline | null;
	scenario: Scenario | null;
}) {
	const [narrative, setNarrative] = useState<string | undefined>(undefined);

	return (
		<div className="flex flex-col gap-3">
			<NarrativeReport onGenerated={setNarrative} />
			<ReportExportButton
				buildDocument={() =>
					buildReportsReport({
						points,
						weeks,
						months,
						sessionsBaseline,
						occurrencesBaseline,
						bookingBaseline,
						ga4ConversionsBaseline,
						scenario,
						narrative,
					})
				}
				filenameBase="relatorio-comparativos"
			/>
		</div>
	);
}
