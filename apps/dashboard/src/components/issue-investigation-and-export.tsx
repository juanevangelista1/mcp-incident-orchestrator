'use client';

import { useState } from 'react';
import { IssueInvestigation } from '@/components/issue-investigation';
import { ReportExportButton } from '@/components/report-export-button';
import { buildIssueReport } from '@/lib/report-export/builders';
import type { SentryIssueDetails } from '@/lib/mcp-types';

// /issues/[id] não tinha nenhum botão de exportar — junta a investigação (Gemini, sob
// demanda) com o export num só componente cliente, pelo mesmo motivo de
// reports-narrative-and-export.tsx: o texto gerado precisa chegar ao PDF/Excel.
export function IssueInvestigationAndExport({ issueId, details }: { issueId: string; details: SentryIssueDetails }) {
	const [narrative, setNarrative] = useState<string | undefined>(undefined);

	return (
		<div className="flex flex-col gap-3">
			<IssueInvestigation issueId={issueId} onGenerated={setNarrative} />
			<ReportExportButton
				buildDocument={() => buildIssueReport({ details, narrative })}
				filenameBase={`issue-${issueId}`}
			/>
		</div>
	);
}
