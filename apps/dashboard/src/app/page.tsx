import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights, DatadogLogsSummary, SentryIssuesSummary } from '@/lib/mcp-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

// Cada fonte é buscada de forma independente (Promise.allSettled): se o Datadog ainda não
// estiver configurado no MCP server, a página não quebra — só mostra aquele card vazio.
async function getSentrySummary(): Promise<SentryIssuesSummary | null> {
	const { data } = await callMcpTool<SentryIssuesSummary>('summarize_sentry_issues', {
		projectSlug: PROJECT_SLUG,
	});
	return data ?? null;
}

async function getDatadogSummary(): Promise<DatadogLogsSummary | null> {
	const { data } = await callMcpTool<DatadogLogsSummary>('summarize_datadog_logs', {});
	return data ?? null;
}

async function getClarityInsights(): Promise<ClarityInsights | null> {
	const { data } = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3 });
	return data ?? null;
}

export default async function OverviewPage() {
	const [sentryResult, datadogResult, clarityResult] = await Promise.allSettled([
		getSentrySummary(),
		getDatadogSummary(),
		getClarityInsights(),
	]);

	const sentry = sentryResult.status === 'fulfilled' ? sentryResult.value : null;
	const datadog = datadogResult.status === 'fulfilled' ? datadogResult.value : null;
	const clarity = clarityResult.status === 'fulfilled' ? clarityResult.value : null;

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
			<header>
				<h1 className="text-2xl font-semibold">Incident Orchestrator — Overview</h1>
				<p className="text-muted-foreground text-sm">
					Sentry, Datadog e Clarity via MCP · projeto{' '}
					<Badge variant="outline">{PROJECT_SLUG || 'não configurado'}</Badge>
				</p>
			</header>

			<section className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<KpiCard label="Erros não resolvidos" value={sentry?.totalIssues} />
				<KpiCard label="Ocorrências (Sentry)" value={sentry?.totalOccurrences} />
				<KpiCard label="Logs (Datadog)" value={datadog?.totalLogs} unavailable={!datadog} />
				<KpiCard label="Sessões (Clarity)" value={clarity?.totalSessions} unavailable={!clarity} />
			</section>

			<section className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Erros mais frequentes (Sentry)</CardTitle>
						<CardDescription>Top rotas/funções por ocorrências</CardDescription>
					</CardHeader>
					<CardContent>
						{sentry && sentry.topCulprits.length > 0 ? (
							<ul className="flex flex-col gap-2 text-sm">
								{sentry.topCulprits.map((c) => (
									<li key={c.culprit} className="flex items-center justify-between gap-4">
										<span className="truncate text-muted-foreground">{c.culprit}</span>
										<Badge variant="secondary">{c.count}</Badge>
									</li>
								))}
							</ul>
						) : (
							<EmptyState label="Nenhum erro encontrado ou Sentry indisponível." />
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Comportamento do usuário (Clarity)</CardTitle>
						<CardDescription>Rage clicks, dead clicks e páginas mais visitadas</CardDescription>
					</CardHeader>
					<CardContent>
						{clarity ? (
							<div className="flex flex-col gap-4 text-sm">
								<div className="flex gap-4">
									<span>
										Rage clicks: <strong>{clarity.rageClicks}</strong>
									</span>
									<span>
										Dead clicks: <strong>{clarity.deadClicks}</strong>
									</span>
									<span>
										Erros de script: <strong>{clarity.scriptErrors}</strong>
									</span>
								</div>
								<ul className="flex flex-col gap-1">
									{clarity.topPages.map((p) => (
										<li key={p.url} className="flex items-center justify-between gap-4">
											<span className="truncate text-muted-foreground">{p.url}</span>
											<Badge variant="secondary">{p.sessions}</Badge>
										</li>
									))}
								</ul>
							</div>
						) : (
							<EmptyState label="Clarity não configurado no MCP server." />
						)}
					</CardContent>
				</Card>
			</section>
		</main>
	);
}

function KpiCard({ label, value, unavailable }: { label: string; value?: number; unavailable?: boolean }) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-3xl">
					{unavailable ? <span className="text-muted-foreground text-base">indisponível</span> : (value ?? '—')}
				</CardTitle>
			</CardHeader>
		</Card>
	);
}

function EmptyState({ label }: { label: string }) {
	return <p className="text-muted-foreground text-sm">{label}</p>;
}
