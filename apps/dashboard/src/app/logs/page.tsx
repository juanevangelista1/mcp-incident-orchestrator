import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { DatadogLogEntry } from '@/lib/mcp-types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function LogsPage() {
	// O plugin do Datadog é opcional no MCP server: se não estiver configurado, a tool
	// nem existe e callMcpTool lança um erro — tratamos aqui em vez de derrubar a página.
	let logs: DatadogLogEntry[] = [];
	let emptyMessage = 'Nenhum log encontrado.';
	try {
		const { data, text } = await callMcpTool<{ logs: DatadogLogEntry[] }>('fetch_datadog_logs', {
			minutesAgo: 60,
			limit: 50,
		});
		logs = data?.logs ?? [];
		emptyMessage = text || emptyMessage;
	} catch {
		emptyMessage = 'Datadog não configurado no MCP server.';
	}

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
			<header>
				<h1 className="text-2xl font-semibold">Logs — Datadog</h1>
				<p className="text-muted-foreground text-sm">Últimos 60 minutos</p>
			</header>

			{logs.length === 0 ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
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
			)}
		</main>
	);
}
