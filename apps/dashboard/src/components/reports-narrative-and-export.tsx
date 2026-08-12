'use client';

import { useState } from 'react';
import { NarrativeReport, type StoredNarrativeProp } from '@/components/narrative-report';
import { ReportExportButton } from '@/components/report-export-button';
import { buildReportsReport } from '@/lib/report-export/builders';
import type { DailyPoint, RollupRow, Baseline } from '@/lib/trends';
import type { Scenario } from '@/lib/scenarios';

// Junta o relatório narrativo (Gemini, sob demanda) com o botão de exportar num único
// componente cliente, porque os dois precisam compartilhar o texto gerado: sem isso, o PDF/
// Excel nunca incluía a cadeia Sintoma->Evidência->...->Ação, só os números (o texto ficava
// preso no estado local do NarrativeReport, que o botão de export não enxergava).
// `initialNarrative` (buscado no SQLite pelo Server Component pai) inicializa os dois ao
// mesmo tempo, pra reabrir a página já com relatório e export prontos, sem gastar Gemini de novo.
export function ReportsNarrativeAndExport({
	points,
	weeks,
	months,
	sessionsBaseline,
	occurrencesBaseline,
	bookingBaseline,
	ga4ConversionsBaseline,
	scenario,
	initialNarrative,
}: {
	points: DailyPoint[];
	weeks: RollupRow[];
	months: RollupRow[];
	sessionsBaseline: Baseline | null;
	occurrencesBaseline: Baseline | null;
	bookingBaseline: Baseline | null;
	ga4ConversionsBaseline: Baseline | null;
	scenario: Scenario | null;
	initialNarrative?: StoredNarrativeProp | null;
}) {
	const [narrative, setNarrative] = useState<string | undefined>(initialNarrative?.text);

	return (
		<div className="flex flex-col gap-3">
			<NarrativeReport onGenerated={setNarrative} initialNarrative={initialNarrative} />
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
