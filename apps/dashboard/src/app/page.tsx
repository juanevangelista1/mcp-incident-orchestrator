import Link from 'next/link';
import { getSentrySummary, getDatadogSummary, getClarityInsights } from '@/lib/mcp-summaries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedMetricList } from '@/components/paginated-metric-list';
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
		<main
			id='main-content'
			className='mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:gap-8 sm:p-8'>
			<header>
				<h1 className='text-xl font-semibold sm:text-2xl'>Orquestrador de Incidentes - Overview</h1>
				<p className='text-muted-foreground text-sm'>
					Sentry, Datadog e Clarity via MCP · projeto{' '}
					<Badge variant='outline'>{PROJECT_SLUG || 'não configurado'}</Badge>
				</p>
			</header>

			<section className='grid grid-cols-2 gap-4 md:grid-cols-4'>
				<KpiCard
					href='/issues'
					label='Erros não resolvidos'
					value={sentry?.totalIssues}
					icon={AlertTriangle}
					accent='text-rose-600 bg-rose-600/10 dark:text-rose-400'
					borderColor='border-t-rose-500/70'
				/>
				<KpiCard
					href='/issues'
					label='Ocorrências (Sentry)'
					value={sentry?.totalOccurrences}
					icon={AlertTriangle}
					accent='text-rose-600 bg-rose-600/10 dark:text-rose-400'
					borderColor='border-t-rose-500/70'
				/>
				<KpiCard
					href='/logs'
					label='Logs (Datadog)'
					value={datadog?.totalLogs}
					unavailable={!datadog}
					icon={Activity}
					accent='text-violet-600 bg-violet-600/10 dark:text-violet-400'
					borderColor='border-t-violet-500/70'
				/>
				<KpiCard
					href='/insights'
					label='Sessões (Clarity)'
					value={clarity?.totalSessions}
					unavailable={!clarity}
					icon={Users}
					accent='text-sky-600 bg-sky-600/10 dark:text-sky-400'
					borderColor='border-t-sky-500/70'
				/>
			</section>

			<section className='grid gap-6 lg:grid-cols-3'>
				<Card className='border-t-4 border-t-rose-500/70'>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<span
								aria-hidden='true'
								className='flex size-7 items-center justify-center rounded-md bg-rose-600/10 text-rose-600 dark:text-rose-400'>
								<AlertTriangle className='size-4' />
							</span>
							<Link
								href='/issues'
								className='hover:underline'>
								<CardTitle>Erros mais frequentes (Sentry)</CardTitle>
							</Link>
						</div>
						<CardDescription>Top rotas/funções por ocorrências</CardDescription>
					</CardHeader>
					<CardContent>
						{sentry && sentry.topCulprits.length > 0 ? (
							<PaginatedMetricList
								items={sentry.topCulprits.map((c) => ({
									label: c.culprit,
									value: c.count,
									href: `/issues?search=${encodeURIComponent(c.culprit)}`,
								}))}
								barColor='bg-rose-500/15'
							/>
						) : (
							<EmptyState label='Nenhum erro encontrado ou Sentry indisponível.' />
						)}
					</CardContent>
				</Card>

				<Card className='border-t-4 border-t-sky-500/70'>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<span
								aria-hidden='true'
								className='flex size-7 items-center justify-center rounded-md bg-sky-600/10 text-sky-600 dark:text-sky-400'>
								<MousePointerClick className='size-4' />
							</span>
							<Link
								href='/insights'
								className='hover:underline'>
								<CardTitle>Comportamento do usuário (Clarity)</CardTitle>
							</Link>
						</div>
						<CardDescription>Rage clicks, dead clicks e páginas mais visitadas</CardDescription>
					</CardHeader>
					<CardContent>
						{clarity ? (
							<div className='flex flex-col gap-4 text-sm'>
								<div className='flex flex-wrap gap-2'>
									<Badge variant='outline'>Rage clicks: {clarity.rageClicks}</Badge>
									<Badge variant='outline'>Dead clicks: {clarity.deadClicks}</Badge>
									<Badge variant='outline'>Erros de script: {clarity.scriptErrors}</Badge>
								</div>
								<PaginatedMetricList
									items={clarity.topPages.map((p) => ({
										label: p.url,
										value: p.sessions,
										href: `/insights?url=${encodeURIComponent(p.url)}`,
									}))}
									barColor='bg-sky-500/15'
								/>
							</div>
						) : (
							<EmptyState label='Clarity não configurado no MCP server.' />
						)}
					</CardContent>
				</Card>

				<Card className='border-t-4 border-t-violet-500/70'>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<span
								aria-hidden='true'
								className='flex size-7 items-center justify-center rounded-md bg-violet-600/10 text-violet-600 dark:text-violet-400'>
								<Activity className='size-4' />
							</span>
							<Link
								href='/logs'
								className='hover:underline'>
								<CardTitle>Logs por serviço (Datadog)</CardTitle>
							</Link>
						</div>
						<CardDescription>Volume por serviço no período monitorado</CardDescription>
					</CardHeader>
					<CardContent>
						{datadog && datadog.byService.length > 0 ? (
							<PaginatedMetricList
								items={datadog.byService.map((s) => ({
									label: s.service,
									value: s.count,
									href: `/logs?service=${encodeURIComponent(s.service)}`,
								}))}
								barColor='bg-violet-500/15'
							/>
						) : (
							<EmptyState label='Nenhum log encontrado ou Datadog indisponível.' />
						)}
					</CardContent>
				</Card>
			</section>
		</main>
	);
}

function KpiCard({
	href,
	label,
	value,
	unavailable,
	icon: Icon,
	accent,
	borderColor,
}: {
	href: string;
	label: string;
	value?: number;
	unavailable?: boolean;
	icon: LucideIcon;
	accent: string;
	borderColor: string;
}) {
	return (
		<Link
			href={href}
			className='block'>
			<Card
				size='sm'
				className={`border-t-4 transition-colors hover:bg-accent/40 ${borderColor}`}>
				<CardHeader>
					<div className='flex items-center justify-between'>
						<CardDescription>{label}</CardDescription>
						<span
							aria-hidden='true'
							className={`flex size-7 items-center justify-center rounded-md ${accent}`}>
							<Icon className='size-4' />
						</span>
					</div>
					<CardTitle className='text-2xl sm:text-3xl'>
						{unavailable ? (
							<span className='text-muted-foreground text-sm sm:text-base'>indisponível</span>
						) : (
							(value ?? '—')
						)}
					</CardTitle>
				</CardHeader>
			</Card>
		</Link>
	);
}

function EmptyState({ label }: { label: string }) {
	return <p className='text-muted-foreground text-sm'>{label}</p>;
}
