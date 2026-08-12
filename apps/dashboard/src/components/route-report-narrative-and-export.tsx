'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownReport } from '@/components/markdown-report';
import { ReportExportButton } from '@/components/report-export-button';
import { buildRouteReportDocument } from '@/lib/report-export/builders';
import type { RouteSnapshot } from '@/lib/route-snapshot';
import type { StoredNarrativeProp } from '@/components/narrative-report';
import { Sparkles, Loader2, TriangleAlert } from 'lucide-react';

// Diagnóstico sob demanda de uma rota (não histórico agregado, não comparação) — mesmo padrão
// de narrative-report.tsx / issue-investigation.tsx / route-comparison-narrative-and-export.tsx.
// `initialNarrative` opcional: já gerado antes (persistido no SQLite, chave "rota|de|até") —
// sem isso, sair da página e voltar perdia o texto e obrigava a gerar de novo.
export function RouteReportNarrativeAndExport({
	route,
	from,
	to,
	snapshot,
	baseline,
	baselineNote,
	initialNarrative,
}: {
	route: string;
	from: string;
	to: string;
	snapshot: RouteSnapshot;
	baseline: { ocorrenciasSentryMedia: number | null; conversoesGa4Media: number | null };
	baselineNote?: string;
	initialNarrative?: StoredNarrativeProp | null;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(initialNarrative ? 'done' : 'idle');
	const [narrative, setNarrative] = useState(initialNarrative?.text ?? '');
	const [error, setError] = useState('');
	const [unverifiedNumbers, setUnverifiedNumbers] = useState<string[]>(initialNarrative?.unverifiedNumbers ?? []);

	async function generate() {
		setState('loading');
		setError('');
		try {
			const res = await fetch('/api/reports/route-narrative', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ snapshot, from, to, baseline }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar diagnóstico.');
			setNarrative(data.report);
			setUnverifiedNumbers(data.unverifiedNumbers ?? []);
			setState('done');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Falha ao gerar diagnóstico.');
			setState('error');
		}
	}

	return (
		<Card className="border-t-4 border-t-indigo-500/70">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="text-indigo-600 dark:text-indigo-400 size-4" />
						Diagnóstico da rota (Gemini)
					</CardTitle>
					<div className="flex shrink-0 gap-2">
						<button
							type="button"
							onClick={generate}
							disabled={state === 'loading'}
							className="focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
						>
							{state === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
							{state === 'loading' ? 'Gerando...' : state === 'done' ? 'Gerar novamente' : 'Gerar diagnóstico'}
						</button>
						<ReportExportButton
							buildDocument={() => buildRouteReportDocument({ route, from, to, snapshot, baselineNote, narrative: narrative || undefined })}
							filenameBase={`rota-relatorio-${route}`}
						/>
					</div>
				</div>
				<CardDescription>
					Sintoma → Evidência → Hipótese → Investigação → Correlação → Causa provável → Impacto → Ação
					recomendada. Correlação sempre por rota/período, nunca por sessão individual.
				</CardDescription>
			</CardHeader>
			{(state === 'done' || state === 'error') && (
				<CardContent>
					{state === 'error' ? (
						<p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
					) : (
						<>
							{unverifiedNumbers.length > 0 && (
								<p className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
									<TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
									Números citados no texto que não batem com os dados brutos. Revise antes de
									confiar: {unverifiedNumbers.join(', ')}
								</p>
							)}
							<MarkdownReport text={narrative} />
						</>
					)}
				</CardContent>
			)}
		</Card>
	);
}
