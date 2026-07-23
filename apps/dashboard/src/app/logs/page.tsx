import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { DatadogLogEntry } from '@/lib/mcp-types';
import { dateToMinutesAgo } from '@/lib/date-range';

export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';
import { toQueryString } from '@/lib/query-string';

type SearchParams = Promise<{ query?: string; service?: string; environment?: string; since?: string }>;

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
	const { query, service, environment, since } = await searchParams;
	const minutesAgo = dateToMinutesAgo(since);

	// O plugin do Datadog é opcional no MCP server: se não estiver configurado, a tool
	// nem existe e callMcpTool lança um erro — tratamos aqui em vez de derrubar a página.
	let logs: DatadogLogEntry[] = [];
	let emptyMessage = 'Nenhum log encontrado para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ logs: DatadogLogEntry[] }>('fetch_datadog_logs', {
			query,
			service,
			environment,
			minutesAgo,
			limit: 50,
		});
		logs = data?.logs ?? [];
		emptyMessage = text || emptyMessage;
	} catch {
		emptyMessage = 'Datadog não configurado no MCP server.';
	}

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Logs — Datadog</h1>
					<p className="text-muted-foreground text-sm">Últimos {minutesAgo} minuto(s)</p>
				</div>
				<a
					href={`/api/export/logs${toQueryString({ query, service, environment, since })}`}
					className="shrink-0 self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
				>
					Baixar CSV
				</a>
			</header>

			<FilterForm
				action="/logs"
				values={{ query, service, environment, since }}
				fields={[
					{ name: 'query', label: 'Busca livre', type: 'text', placeholder: 'timeout' },
					{ name: 'service', label: 'Serviço', type: 'text', placeholder: 'payment-gateway' },
					{ name: 'environment', label: 'Ambiente', type: 'text', placeholder: 'production' },
					{ name: 'since', label: 'Desde (máx. 24h)', type: 'date' },
				]}
			/>

			{logs.length === 0 ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					<div className="flex flex-col gap-3 md:hidden">
						{logs.map((log) => (
							<Card key={log.id}>
								<CardContent className="flex flex-col gap-2">
									<div className="flex items-center justify-between gap-2">
										<Badge variant={log.status === 'error' ? 'destructive' : 'secondary'}>{log.status}</Badge>
										<span className="text-muted-foreground text-xs">{log.timestamp}</span>
									</div>
									<Link href={`/logs/${log.id}`} className="text-sm hover:underline">
										{log.message}
									</Link>
									<span className="text-muted-foreground text-xs">{log.service}</span>
								</CardContent>
							</Card>
						))}
					</div>

					<div className="hidden overflow-x-auto md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Timestamp</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Serviço</TableHead>
									<TableHead>Mensagem</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{logs.map((log) => (
									<TableRow key={log.id}>
										<TableCell className="text-muted-foreground">{log.timestamp}</TableCell>
										<TableCell>
											<Badge variant={log.status === 'error' ? 'destructive' : 'secondary'}>{log.status}</Badge>
										</TableCell>
										<TableCell>{log.service}</TableCell>
										<TableCell className="max-w-md truncate">
											<Link href={`/logs/${log.id}`} className="hover:underline">
												{log.message}
											</Link>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</>
			)}
		</main>
	);
}
