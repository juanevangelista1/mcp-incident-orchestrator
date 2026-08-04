'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Loader2, TriangleAlert } from 'lucide-react';

// Gera sob demanda (nunca automático no carregamento da página) — cada geração é uma chamada
// real ao Gemini, mesmo padrão de narrative-report.tsx em /reports.
// `onGenerated` opcional: permite que o wrapper combinado (issue-investigation-and-export.tsx)
// inclua esse texto no PDF/Excel exportado.
export function IssueInvestigation({
	issueId,
	onGenerated,
}: {
	issueId: string;
	onGenerated?: (text: string) => void;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
	const [report, setReport] = useState('');
	const [error, setError] = useState('');
	const [unverifiedNumbers, setUnverifiedNumbers] = useState<string[]>([]);

	async function generate() {
		setState('loading');
		setError('');
		try {
			const res = await fetch(`/api/issues/${issueId}/narrative`, { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar investigação.');
			setReport(data.report);
			setUnverifiedNumbers(data.unverifiedNumbers ?? []);
			setState('done');
			onGenerated?.(data.report);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Falha ao gerar investigação.');
			setState('error');
		}
	}

	return (
		<Card className="border-t-4 border-t-indigo-500/70">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						<Search className="text-indigo-600 dark:text-indigo-400 size-4" />
						Investigação completa
					</CardTitle>
					<button
						type="button"
						onClick={generate}
						disabled={state === 'loading'}
						className="focus-visible:ring-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
					>
						{state === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
						{state === 'loading' ? 'Investigando...' : 'Gerar investigação completa'}
					</button>
				</div>
				<CardDescription>
					Sintoma → Evidência → Hipótese → Investigação → Correlação → Causa provável → Impacto →
					Ação recomendada — correlação sempre por período, nunca por sessão individual.
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
							<article className="whitespace-pre-wrap text-sm">{report}</article>
						</>
					)}
				</CardContent>
			)}
		</Card>
	);
}
