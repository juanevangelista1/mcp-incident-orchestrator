import { callMcpTool } from '@/lib/mcp-client';
import { DatadogApmTrace } from '@/lib/mcp-types';
import { dateToMinutesAgo } from '@/lib/date-range';

export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';
import { PageTitle } from '@/components/page-title';
import { Pagination, PAGE_SIZE } from '@/components/pagination';
import { Route, ExternalLink } from 'lucide-react';

// APM Traces (spans com status:error) — granularidade de chamada individual, diferente do
// Error Tracking (que agrupa erros em issues "de negócio"). Não tenta desenhar o waterfall
// do trace aqui: cada linha linka pra visualização completa na própria UI do Datadog.
type SearchParams = Promise<{
	query?: string;
	since?: string;
	page?: string;
}>;

export default async function ApmTracesPage({ searchParams }: { searchParams: SearchParams }) {
	const { query, since, page: pageParam } = await searchParams;
	const minutesAgo = dateToMinutesAgo(since);
	const page = Math.max(1, Number(pageParam) || 1);

	let allTraces: DatadogApmTrace[] = [];
	let emptyMessage = 'Nenhum span de erro encontrado para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ traces: DatadogApmTrace[] }>('fetch_datadog_apm_traces', {
			query,
			minutesAgo,
			limit: 50,
		});
		allTraces = data?.traces ?? [];
		emptyMessage = text || emptyMessage;
	} catch {
		emptyMessage = 'Datadog não configurado no MCP server.';
	}

	const totalPages = Math.max(1, Math.ceil(allTraces.length / PAGE_SIZE));
	const traces = allTraces.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={Route}
					accent="bg-teal-600/10 text-teal-600 dark:text-teal-400"
					title="APM Traces — Datadog"
					subtitle={<p className="text-muted-foreground text-sm">Spans com erro, últimas {minutesAgo} minuto(s)</p>}
				/>
			</header>

			<FilterForm
				action="/apm-traces"
				values={{ query, since }}
				fields={[
					{ name: 'query', label: 'Busca (formato Datadog)', type: 'text', placeholder: 'env:production service:api' },
					{ name: 'since', label: 'Desde (máx. 24h)', type: 'date' },
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
										<span className="text-muted-foreground text-xs">{trace.durationMs}ms</span>
									</div>
									<p title={trace.resourceName} className="line-clamp-2 text-sm font-medium">
										{trace.operationName} — {trace.resourceName}
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
									<TableHead>Serviço</TableHead>
									<TableHead>Recurso</TableHead>
									<TableHead>HTTP</TableHead>
									<TableHead className="text-right">Duração</TableHead>
									<TableHead>Timestamp</TableHead>
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
											{trace.httpStatusCode ? `${trace.httpMethod} ${trace.httpStatusCode}` : '—'}
										</TableCell>
										<TableCell className="text-right">{trace.durationMs}ms</TableCell>
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

					<Pagination page={page} totalPages={totalPages} basePath="/apm-traces" params={{ query, since }} />
				</>
			)}
		</main>
	);
}
