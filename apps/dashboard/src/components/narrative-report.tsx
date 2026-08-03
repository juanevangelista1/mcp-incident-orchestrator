'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';

// Gera sob demanda (não a cada carregamento da página) — cada geração é uma chamada real ao
// Gemini, então fica atrás de um clique explícito do usuário, não automático.
// `onGenerated` opcional: permite que um componente pai (ex: reports-narrative-and-export.tsx)
// guarde o texto e o inclua no export em PDF/Excel — antes essa análise só existia na tela.
export function NarrativeReport({ onGenerated }: { onGenerated?: (text: string) => void } = {}) {
	const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
	const [report, setReport] = useState('');
	const [error, setError] = useState('');

	async function generate() {
		setState('loading');
		setError('');
		try {
			const res = await fetch('/api/reports/narrative', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar relatório.');
			setReport(data.report);
			setState('done');
			onGenerated?.(data.report);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Falha ao gerar relatório.');
			setState('error');
		}
	}

	return (
		<Card className="border-t-4 border-t-indigo-500/70">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="text-indigo-600 dark:text-indigo-400 size-4" />
						Relatório narrativo (Gemini)
					</CardTitle>
					<button
						type="button"
						onClick={generate}
						disabled={state === 'loading'}
						className="focus-visible:ring-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
					>
						{state === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
						{state === 'loading' ? 'Gerando...' : 'Gerar relatório'}
					</button>
				</div>
				<CardDescription>
					Causa provável, resumo quantitativo e matriz de confiança, gerados a partir da mesma evidência
					mostrada acima — não é chamado automaticamente.
				</CardDescription>
			</CardHeader>
			{(state === 'done' || state === 'error') && (
				<CardContent>
					{state === 'error' ? (
						<p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
					) : (
						<article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
							{report}
						</article>
					)}
				</CardContent>
			)}
		</Card>
	);
}
