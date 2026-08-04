'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportExportButton } from '@/components/report-export-button';
import { buildRouteComparisonFullReport, type RouteComparisonSnapshot } from '@/lib/report-export/builders';
import { Sparkles, Loader2, TriangleAlert } from 'lucide-react';

// Uma investigação só, comparando as duas rotas (não uma por card) — é uma pergunta única
// ("por que essas duas rotas diferem?"), então um botão só, mesmo padrão sob-demanda de
// narrative-report.tsx e issue-investigation.tsx.
export function RouteComparisonNarrativeAndExport({
	snapshotA,
	snapshotB,
}: {
	snapshotA: RouteComparisonSnapshot;
	snapshotB: RouteComparisonSnapshot;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
	const [narrative, setNarrative] = useState('');
	const [error, setError] = useState('');
	const [unverifiedNumbers, setUnverifiedNumbers] = useState<string[]>([]);

	async function generate() {
		setState('loading');
		setError('');
		try {
			const res = await fetch('/api/issues/comparar/narrative', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ snapshotA, snapshotB }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar comparação.');
			setNarrative(data.report);
			setUnverifiedNumbers(data.unverifiedNumbers ?? []);
			setState('done');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Falha ao gerar comparação.');
			setState('error');
		}
	}

	return (
		<Card className="border-t-4 border-t-indigo-500/70">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="text-indigo-600 dark:text-indigo-400 size-4" />
						Comparação completa (Gemini)
					</CardTitle>
					<div className="flex shrink-0 gap-2">
						<button
							type="button"
							onClick={generate}
							disabled={state === 'loading'}
							className="focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
						>
							{state === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
							{state === 'loading' ? 'Gerando...' : 'Gerar comparação com Gemini'}
						</button>
						<ReportExportButton
							buildDocument={() => buildRouteComparisonFullReport({ snapshotA, snapshotB, narrative: narrative || undefined })}
							filenameBase="comparacao-rotas-completa"
						/>
					</div>
				</div>
				<CardDescription>
					Sintoma → Evidência → Hipótese → Investigação → Correlação → Causa provável → Impacto → Ação
					recomendada — correlação sempre por rota/período, nunca por sessão individual.
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
									Números citados no texto que não batem com os dados brutos — revise antes de
									confiar: {unverifiedNumbers.join(', ')}
								</p>
							)}
							<article className="whitespace-pre-wrap text-sm">{narrative}</article>
						</>
					)}
				</CardContent>
			)}
		</Card>
	);
}
