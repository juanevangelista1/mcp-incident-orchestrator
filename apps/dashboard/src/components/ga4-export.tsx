'use client';

import { ReportExportButton } from '@/components/report-export-button';
import { buildGa4Report } from '@/lib/report-export/builders';
import type { Ga4Summary } from '@/lib/mcp-types';

// Mesmo padrão de insights-export.tsx: fina camada cliente só pra poder passar a função
// buildDocument pro ReportExportButton (Server Components não podem passar closures como prop).
export function Ga4Export({
	data,
	from,
	to,
	pagePathFilter,
	deviceFilter,
	eventNameFilter,
}: {
	data: Ga4Summary;
	from: string;
	to: string;
	pagePathFilter?: string;
	deviceFilter?: string;
	eventNameFilter?: string;
}) {
	return (
		<ReportExportButton
			buildDocument={() => buildGa4Report({ data, from, to, pagePathFilter, deviceFilter, eventNameFilter })}
			filenameBase="ga4"
		/>
	);
}
