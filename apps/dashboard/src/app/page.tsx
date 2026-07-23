import { getSentrySummary, getDatadogSummary, getClarityInsights } from '@/lib/mcp-summaries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Activity, MousePointerClick, Users, type LucideIcon } from 'lucide-react';

// Depende de uma conexão ao vivo com o MCP server — nunca pode ser pré-renderizada em
// build time (o servidor não existe/não está acessível durante o build, ex: no Vercel).
export const dynamic = 'force-dynamic';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

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
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:gap-8 sm:p-8">
			<header>
				<h1 className="text-xl font-semibold sm:text-2xl">Incident Orchestrator — Overview</h1>
				<p className="text-muted-foreground text-sm">
					Sentry, Datadog e Clarity via MCP · projeto{' '}
					<Badge variant="outline">{PROJECT_SLUG || 'não configurado'}</Badge>
				</p>
			</header>

			<section className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<KpiCard
					label="Erros não resolvidos"
					value={sentry?.totalIssues}
					icon={AlertTriangle}
					accent="text-rose-600 bg-rose-600/10 dark:text-rose-400"
				/>
				<KpiCard
					label="Ocorrências (Sentry)"
					value={sentry?.totalOccurrences}
					icon={AlertTriangle}
					accent="text-rose-600 bg-rose-600/10 dark:text-rose-400"
				/>
				<KpiCard
					label="Logs (Datadog)"
					value={datadog?.totalLogs}
					unavailable={!datadog}
					icon={Activity}
					accent="text-violet-600 bg-violet-600/10 dark:text-violet-400"
				/>
				<KpiCard
					label="Sessões (Clarity)"
					value={clarity?.totalSessions}
					unavailable={!clarity}
					icon={Users}
					accent="text-sky-600 bg-sky-600/10 dark:text-sky-400"
				/>
			</section>

			<section className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className="flex size-7 items-center justify-center rounded-md bg-rose-600/10 text-rose-600 dark:text-rose-400"
							>
								<AlertTriangle className="size-4" />
							</span>
							<CardTitle>Erros mais frequentes (Sentry)</CardTitle>
						</div>
						<CardDescription>Top rotas/funções por ocorrências</CardDescription>
					</CardHeader>
					<CardContent>
						{sentry && sentry.topCulprits.length > 0 ? (
							<ul className="flex flex-col gap-2 text-sm">
								{sentry.topCulprits.map((c) => (
									<li key={c.culprit} className="flex items-center justify-between gap-4">
										<span title={c.culprit} className="truncate text-muted-foreground">
											{c.culprit}
										</span>
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
						<div className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className="flex size-7 items-center justify-center rounded-md bg-sky-600/10 text-sky-600 dark:text-sky-400"
							>
								<MousePointerClick className="size-4" />
							</span>
							<CardTitle>Comportamento do usuário (Clarity)</CardTitle>
						</div>
						<CardDescription>Rage clicks, dead clicks e páginas mais visitadas</CardDescription>
					</CardHeader>
					<CardContent>
						{clarity ? (
							<div className="flex flex-col gap-4 text-sm">
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline">Rage clicks: {clarity.rageClicks}</Badge>
									<Badge variant="outline">Dead clicks: {clarity.deadClicks}</Badge>
									<Badge variant="outline">Erros de script: {clarity.scriptErrors}</Badge>
								</div>
								<ul className="flex flex-col gap-1">
									{clarity.topPages.map((p, i) => (
										<li key={`${p.url}-${i}`} className="flex items-center justify-between gap-4">
											<span title={p.url} className="truncate text-muted-foreground">
												{p.url}
											</span>
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

function KpiCard({
	label,
	value,
	unavailable,
	icon: Icon,
	accent,
}: {
	label: string;
	value?: number;
	unavailable?: boolean;
	icon: LucideIcon;
	accent: string;
}) {
	return (
		<Card size="sm">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardDescription>{label}</CardDescription>
					<span aria-hidden="true" className={`flex size-7 items-center justify-center rounded-md ${accent}`}>
						<Icon className="size-4" />
					</span>
				</div>
				<CardTitle className="text-2xl sm:text-3xl">
					{unavailable ? <span className="text-muted-foreground text-sm sm:text-base">indisponível</span> : (value ?? '—')}
				</CardTitle>
			</CardHeader>
		</Card>
	);
}

function EmptyState({ label }: { label: string }) {
	return <p className="text-muted-foreground text-sm">{label}</p>;
}
