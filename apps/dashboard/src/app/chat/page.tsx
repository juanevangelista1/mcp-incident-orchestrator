'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { MessageCircle } from 'lucide-react';

export default function ChatPage() {
	const { messages, sendMessage, status, error } = useChat();
	const [input, setInput] = useState('');

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!input.trim()) return;
		sendMessage({ text: input });
		setInput('');
	}

	return (
		<main id="main-content" className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-8">
			<header>
				<PageTitle
					icon={MessageCircle}
					accent="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"
					title="Chat — Incident Orchestrator"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Pergunte sobre erros, logs ou comportamento de usuários. Ex: &quot;quantos erros tivemos
							hoje?&quot;, &quot;resuma o que aconteceu na aplicação&quot;.
						</p>
					}
				/>
			</header>

			<Card className="flex-1">
				<CardContent aria-live="polite" aria-relevant="additions" className="flex flex-col gap-4">
					{messages.length === 0 && (
						<p className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
					)}
					{messages.map((message) => {
						const isUser = message.role === 'user';
						return (
							<div
								key={message.id}
								className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-2.5 ${
									isUser ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-muted'
								}`}
							>
								<span
									className={`text-xs font-medium uppercase ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
								>
									{isUser ? 'Você' : 'Assistente'}
								</span>
								{message.parts.map((part, i) => {
									if (part.type === 'text') {
										return (
											<p key={i} className="text-sm whitespace-pre-wrap">
												{part.text}
											</p>
										);
									}
									if (part.type.startsWith('tool-')) {
										return (
											<p key={i} className="text-xs italic opacity-70">
												🔧 chamando {part.type.replace('tool-', '')}...
											</p>
										);
									}
									return null;
								})}
							</div>
						);
					})}
					{status === 'submitted' || status === 'streaming' ? (
						<p className="text-muted-foreground text-xs">Pensando…</p>
					) : null}
					{error && (
						<div className="border-destructive/50 bg-destructive/10 text-destructive self-start rounded-2xl border px-4 py-2.5 text-sm">
							{error.message}
						</div>
					)}
				</CardContent>
			</Card>

			<form onSubmit={handleSubmit} className="flex gap-2">
				<label htmlFor="chat-input" className="sr-only">
					Sua pergunta
				</label>
				<input
					id="chat-input"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Pergunte algo sobre a aplicação..."
					className="focus-visible:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
				/>
				<button
					type="submit"
					disabled={status !== 'ready'}
					className="focus-visible:ring-ring rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
				>
					Enviar
				</button>
			</form>
		</main>
	);
}
