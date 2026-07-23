'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function ChatPage() {
	const { messages, sendMessage, status } = useChat();
	const [input, setInput] = useState('');

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!input.trim()) return;
		sendMessage({ text: input });
		setInput('');
	}

	return (
		<main className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-8">
			<header>
				<h1 className="text-xl font-semibold sm:text-2xl">Chat — Incident Orchestrator</h1>
				<p className="text-muted-foreground text-sm">
					Pergunte sobre erros, logs ou comportamento de usuários. Ex: &quot;quantos erros tivemos hoje?&quot;,
					&quot;resuma o que aconteceu na aplicação&quot;.
				</p>
			</header>

			<Card className="flex-1">
				<CardContent className="flex flex-col gap-4">
					{messages.length === 0 && (
						<p className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
					)}
					{messages.map((message) => (
						<div key={message.id} className="flex flex-col gap-1">
							<span className="text-muted-foreground text-xs font-medium uppercase">
								{message.role === 'user' ? 'Você' : 'Assistente'}
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
										<p key={i} className="text-muted-foreground text-xs italic">
											🔧 chamando {part.type.replace('tool-', '')}...
										</p>
									);
								}
								return null;
							})}
						</div>
					))}
					{status === 'submitted' || status === 'streaming' ? (
						<p className="text-muted-foreground text-xs">Pensando…</p>
					) : null}
				</CardContent>
			</Card>

			<form onSubmit={handleSubmit} className="flex gap-2">
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Pergunte algo sobre a aplicação..."
					className="flex-1 rounded-md border px-3 py-2 text-sm"
				/>
				<button
					type="submit"
					disabled={status !== 'ready'}
					className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
				>
					Enviar
				</button>
			</form>
		</main>
	);
}
