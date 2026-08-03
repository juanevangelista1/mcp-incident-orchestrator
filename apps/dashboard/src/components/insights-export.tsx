'use client';

import { ReportExportButton } from '@/components/report-export-button';
import { buildInsightsReport } from '@/lib/report-export/builders';
import type { ClarityInsights, Ga4Summary } from '@/lib/mcp-types';

// Fina camada cliente: só existe pra poder passar uma função (buildDocument) pro
// ReportExportButton — Server Components não podem passar closures como prop pra Client
// Components, então a montagem do ReportDocument acontece aqui, com os dados já buscados
// pela página (nenhum fetch novo).
export function InsightsExport({
	data,
	numOfDays,
	urlFilter,
	deviceFilter,
	ga4,
}: {
	data: ClarityInsights;
	numOfDays: number;
	urlFilter?: string;
	deviceFilter?: string;
	ga4: Ga4Summary | null;
}) {
	return (
		<ReportExportButton
			buildDocument={() => buildInsightsReport({ data, numOfDays, urlFilter, deviceFilter, ga4 })}
			filenameBase="insights-clarity"
		/>
	);
}
