import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssueDetails } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LEVEL_DOT: Record<string, string> = {
	error: 'bg-rose-500',
	warning: 'bg-amber-500',
	info: 'bg-sky-500',
};

export default async function IssueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const data = await callMcpTool<SentryIssueDetails>('get_sentry_issue_details', { issueId: id })
		.then((result) => result.data)
		.catch(() => undefined);

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Link href="/issues" className="text-muted-foreground text-sm hover:underline">
				← Voltar para Issues
			</Link>

			{!data ? (
				<p className="text-muted-foreground text-sm">Não foi possível carregar os detalhes desse erro.</p>
			) : (
				<>
					<header>
						<h1 className="text-xl font-semibold">{data.errorMessage}</h1>
						<p className="text-muted-foreground text-sm">ID: {data.id}</p>
					</header>

					{/* Contexto (browser/OS/device/localização) — mesmo painel que a própria UI do Sentry
					    mostra ao lado do gráfico de eventos. */}
					<Card>
						<CardHeader>
							<CardTitle>Contexto</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
								<ContextItem label="Navegador" value={data.context.browser} />
								<ContextItem label="Sistema" value={data.context.os} />
								<ContextItem label="Dispositivo" value={data.context.device} />
								<ContextItem label="Localização" value={data.context.location} />
								<ContextItem label="Idioma" value={data.context.locale} />
								<ContextItem label="Fuso horário" value={data.context.timezone} />
							</dl>
						</CardContent>
					</Card>

					{data.request && (
						<Card>
							<CardHeader>
								<CardTitle>HTTP Request</CardTitle>
							</CardHeader>
							<CardContent>
								<dl className="flex flex-col gap-3 text-sm">
									<ContextItem label="URL" value={data.request.url} mono />
									<div className="flex gap-6">
										<ContextItem label="Método" value={data.request.method} />
										<ContextItem label="Referer" value={data.request.referer} mono />
									</div>
									<ContextItem label="User-Agent" value={data.request.userAgent} mono />
								</dl>
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader>
							<CardTitle>Stack Trace</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="overflow-x-auto text-xs whitespace-pre-wrap">
								{data.stackTrace.join('\n')}
							</pre>
						</CardContent>
					</Card>

					{data.breadcrumbs.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Breadcrumbs</CardTitle>
							</CardHeader>
							<CardContent>
								<ol className="flex flex-col gap-3 text-sm">
									{data.breadcrumbs.map((b, i) => (
										<li key={i} className="flex items-start gap-3">
											<span
												aria-hidden="true"
												className={`mt-1.5 size-2 shrink-0 rounded-full ${LEVEL_DOT[b.level] ?? 'bg-muted-foreground'}`}
											/>
											<div className="flex min-w-0 flex-col gap-0.5">
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant="outline" className="text-xs">
														{b.category}
													</Badge>
													<span className="text-muted-foreground text-xs">{b.timestamp}</span>
												</div>
												<span className="text-foreground/90 break-words">{b.description}</span>
											</div>
										</li>
									))}
								</ol>
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader>
							<CardTitle>Tags</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
								{Object.entries(data.tags).map(([key, value]) => (
									<div key={key} className="flex items-baseline justify-between gap-2 border-b pb-1.5">
										<dt className="text-muted-foreground shrink-0">{key}</dt>
										<dd className="truncate text-right" title={value}>
											{value}
										</dd>
									</div>
								))}
							</dl>
						</CardContent>
					</Card>
				</>
			)}
		</main>
	);
}

function ContextItem({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
	if (!value) return null;
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className={`break-words ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
		</div>
	);
}
