import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { DatadogApmTrace, DatadogErrorIssue } from '@/lib/mcp-types';
import { dateToMinutesAgo } from '@/lib/date-range';

export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';
import { PageTitle } from '@/components/page-title';
import { Pagination, PAGE_SIZE } from '@/components/pagination';
import { toQueryString } from '@/lib/query-string';
import { formatNumberBR } from '@/lib/format';
import { TodayDelayWarning } from '@/components/today-delay-warning';
import { Bug, Route, ExternalLink, ArrowUpDown } from 'lucide-react';

// Error Tracking (issues agrupadas) e APM Traces (spans individuais com erro) eram duas
// páginas/rotas separadas — juntadas aqui numa só com um toggle (`view`), porque são as duas
// faces do mesmo produto Datadog e o usuário não deveria precisar navegar pra outra rota só
// pra alternar entre "o que agrupado está dando erro" e "qual chamada específica falhou".
// Trocar de view reseta os filtros (os campos não são os mesmos nos dois lados — Estado só
// existe em Error Tracking, Status HTTP só em APM Traces) — não dá pra preservar sem confundir.
type View = 'errors' | 'traces';

type SearchParams = Promise<{
	view?: string;
	service?: string;
	environment?: string;
	state?: string;
	httpStatusCode?: string;
	query?: string;
	since?: string;
	page?: string;
	sort?: string;
	dir?: string;
}>;

const STATE_BADGE_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
	OPEN: 'destructive',
	ACKNOWLEDGED: 'secondary',
	RESOLVED: 'outline',
	IGNORED: 'outline',
	EXCLUDED: 'outline',
};

const STATE_OPTIONS = [
	{ value: 'OPEN', label: 'Open' },
	{ value: 'ACKNOWLEDGED', label: 'Acknowledged' },
	{ value: 'RESOLVED', label: 'Resolved' },
	{ value: 'IGNORED', label: 'Ignored' },
	{ value: 'EXCLUDED', label: 'Excluded' },
];

export default async function DatadogPage({ searchParams }: { searchParams: SearchParams }) {
	const params = await searchParams;
	const view: View = params.view === 'traces' ? 'traces' : 'errors';

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={view === 'traces' ? Route : Bug}
					accent={
						view === 'traces'
							? 'bg-teal-600/10 text-teal-600 dark:text-teal-400'
							: 'bg-orange-600/10 text-orange-600 dark:text-orange-400'
					}
					title="DataDog"
					subtitle={
						<p className="text-muted-foreground text-sm">
							{view === 'traces'
								? 'APM Traces: spans com erro, granularidade de chamada individual'
								: 'Error Tracking: erros agrupados em issues de negócio'}
						</p>
					}
				/>
				<div className="inline-flex shrink-0 gap-1 rounded-lg border p-1">
					<ViewToggle view="errors" active={view === 'errors'} label="Error Tracking" />
					<ViewToggle view="traces" active={view === 'traces'} label="APM Traces" />
				</div>
			</header>

			{/* "since" só controla o início da janela — o fim é sempre "agora", então hoje está
			    sempre incluído, sem precisar checar nenhum filtro. */}
			<TodayDelayWarning />

			{view === 'traces' ? <ApmTracesView params={params} /> : <ErrorTrackingView params={params} />}
		</main>
	);
}

function ViewToggle({ view, active, label }: { view: View; active: boolean; label: string }) {
	return (
		<Link
			href={`/datadog${toQueryString({ view })}`}
			className={`focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
				active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60'
			}`}
		>
			{label}
		</Link>
	);
}

type ErrorSortKey = 'service' | 'lastSeen' | 'totalCount';
const ERROR_SORT_KEYS: ErrorSortKey[] = ['service', 'lastSeen', 'totalCount'];

async function ErrorTrackingView({ params }: { params: Awaited<SearchParams> }) {
	const { service, environment, state, query, since, page: pageParam, sort, dir } = params;
	const minutesAgo = dateToMinutesAgo(since);
	const page = Math.max(1, Number(pageParam) || 1);
	const sortKey: ErrorSortKey = ERROR_SORT_KEYS.includes(sort as ErrorSortKey) ? (sort as ErrorSortKey) : 'totalCount';
	const sortDir: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';

	const queryParts: string[] = [];
	if (service) queryParts.push(`service:${service}`);
	if (environment) queryParts.push(`env:${environment}`);
	if (state) queryParts.push(`state:${state}`);
	if (query) queryParts.push(query);
	const combinedQuery = queryParts.length > 0 ? queryParts.join(' ') : undefined;

	let allIssues: DatadogErrorIssue[] = [];
	let emptyMessage = 'Nenhuma issue encontrada para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ issues: DatadogErrorIssue[] }>('fetch_datadog_error_issues', {
			query: combinedQuery,
			minutesAgo,
			limit: 50,
		});
		allIssues = data?.issues ?? [];
		emptyMessage = text || emptyMessage;
	} catch {
		emptyMessage = 'Datadog não configurado no MCP server.';
	}

	const sortedIssues = [...allIssues].sort((a, b) => {
		let cmp: number;
		if (sortKey === 'service') cmp = a.service.localeCompare(b.service);
		else if (sortKey === 'lastSeen') cmp = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
		else cmp = a.totalCount - b.totalCount;
		return sortDir === 'asc' ? cmp : -cmp;
	});

	const totalPages = Math.max(1, Math.ceil(sortedIssues.length / PAGE_SIZE));
	const issues = sortedIssues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	const sortHref = (key: ErrorSortKey) => {
		const nextDir = sortKey === key && sortDir === 'desc' ? 'asc' : 'desc';
		return `/datadog${toQueryString({ view: 'errors', service, environment, state, query, since, sort: key, dir: nextDir })}`;
	};
	const sortIndicator = (key: ErrorSortKey) => (sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : '');

	return (
		<>
			<FilterForm
				action="/datadog"
				values={{ view: 'errors', service, environment, state, query, since }}
				fields={[
					{ name: 'service', label: 'Serviço', type: 'text', placeholder: 'lello-web' },
					{ name: 'environment', label: 'Ambiente', type: 'text', placeholder: 'production' },
					{ name: 'state', label: 'Estado', type: 'select', options: STATE_OPTIONS },
					{ name: 'since', label: 'Desde (máx. 24h)', type: 'date' },
					{ name: 'query', label: 'Busca avançada (formato Datadog)', type: 'text', placeholder: 'is_crash:true' },
				]}
			/>

			{issues.length === 0 ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					<div className="flex flex-col gap-3 md:hidden">
						{issues.map((issue) => (
							<Link key={issue.id} href={`/error-tracking/${issue.id}`} className="block">
								<Card className="transition-colors hover:bg-accent/40">
									<CardContent className="flex flex-col gap-2">
										<div className="flex items-center justify-between gap-2">
											<Badge variant={STATE_BADGE_VARIANT[issue.state] ?? 'outline'}>{issue.state}</Badge>
											<span className="text-muted-foreground text-xs">{formatNumberBR(issue.totalCount)}x</span>
										</div>
										<p title={issue.errorMessage} className="line-clamp-2 text-sm font-medium">
											{issue.errorType}: {issue.errorMessage}
										</p>
										<span className="text-muted-foreground text-xs">
											{issue.service} · última vez {new Date(issue.lastSeen).toLocaleString('pt-BR')}
										</span>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>

					<div className="hidden overflow-x-auto md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<Link href={sortHref('service')} className="inline-flex items-center gap-1 hover:underline">
											Serviço <ArrowUpDown className="size-3" /> {sortIndicator('service')}
										</Link>
									</TableHead>
									<TableHead>Erro</TableHead>
									<TableHead>Estado</TableHead>
									<TableHead>
										<Link href={sortHref('lastSeen')} className="inline-flex items-center gap-1 hover:underline">
											Última ocorrência <ArrowUpDown className="size-3" /> {sortIndicator('lastSeen')}
										</Link>
									</TableHead>
									<TableHead className="text-right">
										<Link href={sortHref('totalCount')} className="inline-flex items-center justify-end gap-1 hover:underline">
											Ocorrências <ArrowUpDown className="size-3" /> {sortIndicator('totalCount')}
										</Link>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{issues.map((issue) => (
									<TableRow key={issue.id}>
										<TableCell>{issue.service}</TableCell>
										<TableCell title={issue.errorMessage} className="max-w-md truncate">
											<Link href={`/error-tracking/${issue.id}`} className="hover:underline">
												<span className="font-medium">{issue.errorType}</span>: {issue.errorMessage}
											</Link>
										</TableCell>
										<TableCell>
											<Badge variant={STATE_BADGE_VARIANT[issue.state] ?? 'outline'}>{issue.state}</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{new Date(issue.lastSeen).toLocaleString('pt-BR')}
										</TableCell>
										<TableCell className="text-right">
											<Badge variant="secondary">{formatNumberBR(issue.totalCount)}</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					<Pagination
						page={page}
						totalPages={totalPages}
						basePath="/datadog"
						params={{ view: 'errors', service, environment, state, query, since, sort: sortKey, dir: sortDir }}
					/>
				</>
			)}
		</>
	);
}

type TraceSortKey = 'service' | 'duration' | 'timestamp';
const TRACE_SORT_KEYS: TraceSortKey[] = ['service', 'duration', 'timestamp'];

async function ApmTracesView({ params }: { params: Awaited<SearchParams> }) {
	const { service, environment, httpStatusCode, query, since, page: pageParam, sort, dir } = params;
	const minutesAgo = dateToMinutesAgo(since);
	const page = Math.max(1, Number(pageParam) || 1);
	const sortKey: TraceSortKey = TRACE_SORT_KEYS.includes(sort as TraceSortKey) ? (sort as TraceSortKey) : 'timestamp';
	const sortDir: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';

	const queryParts: string[] = [];
	if (service) queryParts.push(`service:${service}`);
	if (environment) queryParts.push(`env:${environment}`);
	if (httpStatusCode) queryParts.push(`http.status_code:${httpStatusCode}`);
	if (query) queryParts.push(query);
	const combinedQuery = queryParts.length > 0 ? queryParts.join(' ') : undefined;

	let allTraces: DatadogApmTrace[] = [];
	let emptyMessage = 'Nenhum span de erro encontrado para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ traces: DatadogApmTrace[] }>('fetch_datadog_apm_traces', {
			query: combinedQuery,
			minutesAgo,
			limit: 50,
		});
		allTraces = data?.traces ?? [];
		emptyMessage = text || emptyMessage;
	} catch {
		emptyMessage = 'Datadog não configurado no MCP server.';
	}

	const sortedTraces = [...allTraces].sort((a, b) => {
		let cmp: number;
		if (sortKey === 'service') cmp = a.service.localeCompare(b.service);
		else if (sortKey === 'duration') cmp = a.durationMs - b.durationMs;
		else cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		return sortDir === 'asc' ? cmp : -cmp;
	});

	const totalPages = Math.max(1, Math.ceil(sortedTraces.length / PAGE_SIZE));
	const traces = sortedTraces.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	const sortHref = (key: TraceSortKey) => {
		const nextDir = sortKey === key && sortDir === 'desc' ? 'asc' : 'desc';
		return `/datadog${toQueryString({ view: 'traces', service, environment, httpStatusCode, query, since, sort: key, dir: nextDir })}`;
	};
	const sortIndicator = (key: TraceSortKey) => (sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : '');

	return (
		<>
			<FilterForm
				action="/datadog"
				values={{ view: 'traces', service, environment, httpStatusCode, query, since }}
				fields={[
					{ name: 'service', label: 'Serviço', type: 'text', placeholder: 'lello-web' },
					{ name: 'environment', label: 'Ambiente', type: 'text', placeholder: 'production' },
					{ name: 'httpStatusCode', label: 'Status HTTP', type: 'text', placeholder: '500' },
					{ name: 'since', label: 'Desde (máx. 24h)', type: 'date' },
					{ name: 'query', label: 'Busca avançada (formato Datadog)', type: 'text', placeholder: 'resource_name:*checkout*' },
				]}
			/>

			{traces.length === 0 ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					<div className="flex flex-col gap-3 md:hidden">
						{traces.map((trace) => (
							<Card key={trace.id}>
								<CardContent className="flex flex-col gap-2">
									<div className="flex items-center justify-between gap-2">
										<Badge variant="destructive">{trace.status}</Badge>
										<span className="text-muted-foreground text-xs">{formatNumberBR(trace.durationMs)}ms</span>
									</div>
									<p title={trace.resourceName} className="line-clamp-2 text-sm font-medium">
										{trace.operationName}: {trace.resourceName}
									</p>
									<span className="text-muted-foreground text-xs">
										{trace.service} · {trace.env}
										{trace.httpStatusCode ? ` · HTTP ${trace.httpMethod} ${trace.httpStatusCode}` : ''}
									</span>
									<a
										href={trace.traceUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
									>
										Ver trace no Datadog <ExternalLink className="size-3" />
									</a>
								</CardContent>
							</Card>
						))}
					</div>

					<div className="hidden overflow-x-auto md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<Link href={sortHref('service')} className="inline-flex items-center gap-1 hover:underline">
											Serviço <ArrowUpDown className="size-3" /> {sortIndicator('service')}
										</Link>
									</TableHead>
									<TableHead>Recurso</TableHead>
									<TableHead>HTTP</TableHead>
									<TableHead className="text-right">
										<Link href={sortHref('duration')} className="inline-flex items-center justify-end gap-1 hover:underline">
											Duração <ArrowUpDown className="size-3" /> {sortIndicator('duration')}
										</Link>
									</TableHead>
									<TableHead>
										<Link href={sortHref('timestamp')} className="inline-flex items-center gap-1 hover:underline">
											Timestamp <ArrowUpDown className="size-3" /> {sortIndicator('timestamp')}
										</Link>
									</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{traces.map((trace) => (
									<TableRow key={trace.id}>
										<TableCell>
											{trace.service}
											<span className="text-muted-foreground block text-xs">{trace.env}</span>
										</TableCell>
										<TableCell title={trace.resourceName} className="max-w-md truncate">
											<span className="font-medium">{trace.operationName}</span>: {trace.resourceName}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{trace.httpStatusCode ? `${trace.httpMethod} ${trace.httpStatusCode}` : '-'}
										</TableCell>
										<TableCell className="text-right">{formatNumberBR(trace.durationMs)}ms</TableCell>
										<TableCell className="text-muted-foreground">
											{new Date(trace.timestamp).toLocaleString('pt-BR')}
										</TableCell>
										<TableCell>
											<a
												href={trace.traceUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
											>
												Datadog <ExternalLink className="size-3" />
											</a>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					<Pagination
						page={page}
						totalPages={totalPages}
						basePath="/datadog"
						params={{ view: 'traces', service, environment, httpStatusCode, query, since, sort: sortKey, dir: sortDir }}
					/>
				</>
			)}
		</>
	);
}
