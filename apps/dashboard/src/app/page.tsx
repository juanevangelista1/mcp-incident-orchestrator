import Link from 'next/link';
// getSentrySummary: fora de uso enquanto o Sentry está escondido da Overview (ver abaixo).
import {
	/* getSentrySummary, */ getDatadogErrorSummary,
	getClarityInsights,
	getGa4Summary,
} from '@/lib/mcp-summaries';
import { formatNumberBR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedMetricList } from '@/components/paginated-metric-list';
import {
	/* AlertTriangle, */ Bug,
	MousePointerClick,
	Users,
	BarChart3,
	type LucideIcon,
} from 'lucide-react';

// Depende de uma conexão ao vivo com o MCP server: nunca pode ser pré-renderizada em
// build time (o servidor não existe/não está acessível durante o build, ex: no Vercel).
export const dynamic = 'force-dynamic';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

export default async function OverviewPage() {
	const [datadogResult, clarityResult, ga4Result] = await Promise.allSettled([
		// getSentrySummary(), — ver comentário no import acima.
		getDatadogErrorSummary(),
		getClarityInsights(),
		getGa4Summary(),
	]);

	const datadog = datadogResult.status === 'fulfilled' ? datadogResult.value : null;
	const clarity = clarityResult.status === 'fulfilled' ? clarityResult.value : null;
	const ga4 = ga4Result.status === 'fulfilled' ? ga4Result.value : null;

	return (
		<main
			id='main-content'
			className='mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:gap-8 sm:p-8'>
			<header>
				<h1 className='text-xl font-semibold sm:text-2xl'>Orquestrador de Incidentes: Overview</h1>
				<p className='text-muted-foreground text-sm'>
					Datadog, Clarity e GA4 via MCP · projeto{' '}
					<Badge variant='outline'>{PROJECT_SLUG || 'não configurado'}</Badge>
				</p>
			</header>

			<section className='grid grid-cols-2 gap-4 md:grid-cols-3'>
				{/* Sentry temporariamente fora da Overview.
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
				*/}
				<KpiCard
					href='/datadog?view=errors'
					label='Erros (Datadog)'
					value={datadog?.totalOccurrences}
					unavailable={!datadog}
					icon={Bug}
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
				<KpiCard
					href='/ga4'
					label='Conversões (GA4)'
					value={ga4?.conversions ?? undefined}
					unavailable={!ga4 || ga4.conversions == null}
					icon={BarChart3}
					accent='text-teal-600 bg-teal-600/10 dark:text-teal-400'
					borderColor='border-t-teal-500/70'
				/>
			</section>

			<section className='grid gap-6 lg:grid-cols-3'>
				{/* Sentry temporariamente fora da Overview.
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
				*/}

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
									<Badge variant='outline'>Rage clicks: {formatNumberBR(clarity.rageClicks)}</Badge>
									<Badge variant='outline'>Dead clicks: {formatNumberBR(clarity.deadClicks)}</Badge>
									<Badge variant='outline'>Erros de script: {formatNumberBR(clarity.scriptErrors)}</Badge>
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
								<Bug className='size-4' />
							</span>
							<Link
								href='/datadog?view=errors'
								className='hover:underline'>
								<CardTitle>Erros por serviço (Datadog)</CardTitle>
							</Link>
						</div>
						<CardDescription>Ocorrências por serviço, últimas 24h (Error Tracking)</CardDescription>
					</CardHeader>
					<CardContent>
						{datadog && datadog.byService.length > 0 ? (
							<PaginatedMetricList
								items={datadog.byService.map((s) => ({
									label: s.service,
									value: s.count,
									href: `/datadog?view=errors&service=${encodeURIComponent(s.service)}`,
								}))}
								barColor='bg-violet-500/15'
							/>
						) : (
							<EmptyState label='Nenhuma issue encontrada ou Datadog indisponível.' />
						)}
					</CardContent>
				</Card>

				<Card className='border-t-4 border-t-teal-500/70'>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<span
								aria-hidden='true'
								className='flex size-7 items-center justify-center rounded-md bg-teal-600/10 text-teal-600 dark:text-teal-400'>
								<BarChart3 className='size-4' />
							</span>
							<Link
								href='/ga4'
								className='hover:underline'>
								<CardTitle>Conversão real (Google Analytics 4)</CardTitle>
							</Link>
						</div>
						<CardDescription>
							Dado real de conversão, não é proxy de comportamento como o Clarity
						</CardDescription>
					</CardHeader>
					<CardContent>
						{ga4 ? (
							<div className='flex flex-col gap-4 text-sm'>
								<div className='flex flex-wrap gap-2'>
									<Badge variant='outline'>Sessões: {formatNumberBR(ga4.sessions)}</Badge>
								</div>
								<PaginatedMetricList
									items={ga4.topPagesBySessions.map((p) => ({
										label: p.page,
										value: p.sessions,
										href: `/ga4?pages_pagePath=${encodeURIComponent(p.page)}`,
									}))}
									barColor='bg-teal-500/15'
								/>
							</div>
						) : (
							<EmptyState label='GA4 não configurado no MCP server.' />
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
						) : value != null ? (
							formatNumberBR(value)
						) : (
							'-'
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
