import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { DatadogErrorIssueDetails } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATE_BADGE_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
	OPEN: 'destructive',
	ACKNOWLEDGED: 'secondary',
	RESOLVED: 'outline',
	IGNORED: 'outline',
	EXCLUDED: 'outline',
};

export default async function ErrorTrackingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const data = await callMcpTool<DatadogErrorIssueDetails>('get_datadog_error_issue_details', { issueId: id })
		.then((result) => result.data)
		.catch(() => undefined);

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Link href="/datadog?view=errors" className="text-muted-foreground text-sm hover:underline">
				← Voltar para Error Tracking
			</Link>

			{!data ? (
				<p className="text-muted-foreground text-sm">Não foi possível carregar os detalhes dessa issue.</p>
			) : (
				<>
					<header className="flex flex-col gap-2">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant={STATE_BADGE_VARIANT[data.state] ?? 'outline'}>{data.state}</Badge>
							{data.isCrash && <Badge variant="destructive">Crash</Badge>}
							<Badge variant="outline">{data.platform}</Badge>
						</div>
						<h1 className="text-xl font-semibold">{data.errorType}</h1>
						<p className="text-muted-foreground text-sm break-words">{data.errorMessage}</p>
						<p className="text-muted-foreground text-xs">ID: {data.id}</p>
					</header>

					<Card>
						<CardHeader>
							<CardTitle>Origem</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
								<ContextItem label="Serviço" value={data.service} />
								<ContextItem label="Arquivo" value={data.filePath} mono />
								<ContextItem label="Função" value={data.functionName} mono />
								<ContextItem label="Linguagens" value={data.languages.join(', ') || undefined} />
							</dl>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Linha do tempo</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
								<ContextItem label="Primeira vez" value={new Date(data.firstSeen).toLocaleString('pt-BR')} />
								<ContextItem label="Última vez" value={new Date(data.lastSeen).toLocaleString('pt-BR')} />
								<ContextItem label="Versão (1ª vez)" value={data.firstSeenVersion} mono />
								<ContextItem label="Versão (última vez)" value={data.lastSeenVersion} mono />
							</dl>
						</CardContent>
					</Card>

					{data.regression && (
						<Card className="border-t-4 border-t-amber-500/70">
							<CardHeader>
								<CardTitle>Regressão</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground text-sm">
									Essa issue tinha sido resolvida em{' '}
									<span className="text-foreground">{new Date(data.regression.resolvedAt).toLocaleString('pt-BR')}</span> e
									voltou a ocorrer em{' '}
									<span className="text-foreground">{new Date(data.regression.regressedAt).toLocaleString('pt-BR')}</span>.
								</p>
							</CardContent>
						</Card>
					)}
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
