'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { ReportExportButton } from '@/components/report-export-button';
import { buildChatConversationReport } from '@/lib/report-export/builders';
import type { StaticAnswer } from '@/lib/chat-static-answers';
import { MessageCircle, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface ConversationEntry extends StaticAnswer {
	geminiState: 'idle' | 'loading' | 'done' | 'error';
	geminiAnalysis?: string;
	geminiError?: string;
}

export default function ChatPage() {
	const [staticAnswers, setStaticAnswers] = useState<StaticAnswer[]>([]);
	const [loadingAnswers, setLoadingAnswers] = useState(true);
	const [conversation, setConversation] = useState<ConversationEntry[]>([]);

	// Busca uma vez, ao montar — nenhuma chamada ao Gemini aqui, só agrega dados já cacheados
	// (mesmas chamadas que /issues, /insights e /reports já fazem).
	useEffect(() => {
		fetch('/api/chat/static-answers')
			.then((res) => res.json())
			.then((data) => setStaticAnswers(data.answers ?? []))
			.finally(() => setLoadingAnswers(false));
	}, []);

	function askQuestion(answer: StaticAnswer) {
		setConversation((prev) => {
			if (prev.some((e) => e.id === answer.id)) return prev;
			return [...prev, { ...answer, geminiState: 'idle' }];
		});
	}

	async function generateGeminiAnalysis(id: string) {
		setConversation((prev) => prev.map((e) => (e.id === id ? { ...e, geminiState: 'loading' } : e)));
		try {
			const res = await fetch('/api/reports/narrative', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar análise.');
			setConversation((prev) =>
				prev.map((e) => (e.id === id ? { ...e, geminiState: 'done', geminiAnalysis: data.report } : e)),
			);
		} catch (error) {
			setConversation((prev) =>
				prev.map((e) =>
					e.id === id
						? { ...e, geminiState: 'error', geminiError: error instanceof Error ? error.message : 'Falha ao gerar análise.' }
						: e,
				),
			);
		}
	}

	const askedIds = new Set(conversation.map((e) => e.id));

	return (
		<main id="main-content" className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-8">
			<header>
				<PageTitle
					icon={MessageCircle}
					accent="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"
					title="Chat — Orquestrador de Incidentes"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Perguntas de resposta instantânea (sem gastar cota do Gemini) — clique numa pergunta abaixo.
							Para as perguntas de causa/relação, você também pode gerar uma análise com Gemini sob demanda.
						</p>
					}
				/>
			</header>

			<Card>
				<CardContent className="flex flex-col gap-3">
					<h2 className="text-sm font-medium">Perguntas rápidas</h2>
					{loadingAnswers ? (
						<p className="text-muted-foreground text-sm">Carregando…</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{staticAnswers.map((a) => (
								<button
									key={a.id}
									type="button"
									onClick={() => askQuestion(a)}
									disabled={askedIds.has(a.id)}
									className="focus-visible:ring-ring rounded-full border px-3 py-1.5 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
								>
									{a.question}
								</button>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="flex-1">
				<CardContent aria-live="polite" aria-relevant="additions" className="flex flex-col gap-4">
					{conversation.length === 0 && (
						<p className="text-muted-foreground text-sm">Clique numa pergunta acima para ver a resposta.</p>
					)}
					{conversation.map((entry) => (
						<div key={entry.id} className="flex flex-col gap-2 rounded-lg border p-3">
							<p className="text-sm font-medium">{entry.question}</p>
							<p className="text-sm whitespace-pre-wrap">{entry.answer}</p>
							{entry.link && (
								<Link href={entry.link.href} className="text-muted-foreground text-xs hover:underline">
									{entry.link.label} →
								</Link>
							)}
							{entry.narrativeCapable && (
								<div className="mt-1 flex flex-col gap-2 border-t pt-2">
									{entry.geminiState !== 'done' && (
										<button
											type="button"
											onClick={() => generateGeminiAnalysis(entry.id)}
											disabled={entry.geminiState === 'loading'}
											className="focus-visible:ring-ring inline-flex w-fit items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
										>
											{entry.geminiState === 'loading' ? (
												<Loader2 className="size-3.5 animate-spin" />
											) : (
												<Sparkles className="size-3.5" />
											)}
											{entry.geminiState === 'loading' ? 'Gerando...' : 'Gerar análise com Gemini'}
										</button>
									)}
									{entry.geminiState === 'error' && (
										<p className="text-rose-600 dark:text-rose-400 text-xs">{entry.geminiError}</p>
									)}
									{entry.geminiState === 'done' && entry.geminiAnalysis && (
										<article className="whitespace-pre-wrap text-sm">{entry.geminiAnalysis}</article>
									)}
								</div>
							)}
						</div>
					))}
				</CardContent>
			</Card>

			{conversation.length > 0 && (
				<ReportExportButton
					buildDocument={() =>
						buildChatConversationReport(
							conversation.map((e) => ({ question: e.question, answer: e.answer, geminiAnalysis: e.geminiAnalysis })),
						)
					}
					filenameBase="chat-perguntas-respostas"
				/>
			)}
		</main>
	);
}
