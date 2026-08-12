'use client';

import { useState } from 'react';
import { IssueInvestigation } from '@/components/issue-investigation';
import type { StoredNarrativeProp } from '@/components/narrative-report';
import { ReportExportButton } from '@/components/report-export-button';
import { buildIssueReport } from '@/lib/report-export/builders';
import type { SentryIssueDetails } from '@/lib/mcp-types';

// /issues/[id] não tinha nenhum botão de exportar — junta a investigação (Gemini, sob
// demanda) com o export num só componente cliente, pelo mesmo motivo de
// reports-narrative-and-export.tsx: o texto gerado precisa chegar ao PDF/Excel.
// `initialNarrative` (buscado no SQLite pelo Server Component pai) evita gerar de novo (e
// gastar cota do Gemini) só porque o usuário saiu da página e voltou.
export function IssueInvestigationAndExport({
	issueId,
	details,
	initialNarrative,
}: {
	issueId: string;
	details: SentryIssueDetails;
	initialNarrative?: StoredNarrativeProp | null;
}) {
	const [narrative, setNarrative] = useState<string | undefined>(initialNarrative?.text);

	return (
		<div className="flex flex-col gap-3">
			<IssueInvestigation issueId={issueId} onGenerated={setNarrative} initialNarrative={initialNarrative} />
			<ReportExportButton
				buildDocument={() => buildIssueReport({ details, narrative })}
				filenameBase={`issue-${issueId}`}
			/>
		</div>
	);
}
