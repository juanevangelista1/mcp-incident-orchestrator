import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { AwsLogEntry } from '@/lib/mcp-types';
import { dateToMinutesAgo } from '@/lib/date-range';

export const dynamic = 'force-dynamic';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';

type SearchParams = Promise<{ filterPattern?: string; logGroupName?: string; since?: string }>;

export default async function AwsLogsPage({ searchParams }: { searchParams: SearchParams }) {
	const { filterPattern, logGroupName, since } = await searchParams;
	const minutesAgo = dateToMinutesAgo(since);

	// O plugin da AWS é opcional no MCP server: se não estiver configurado, a tool nem
	// existe e callMcpTool lança um erro — tratamos aqui em vez de derrubar a página.
	let logs: AwsLogEntry[] = [];
	let emptyMessage = 'Nenhum evento encontrado para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ logs: AwsLogEntry[] }>('fetch_aws_logs', {
			filterPattern,
			logGroupName,
			minutesAgo,
			limit: 50,
		});
		logs = data?.logs ?? [];
		emptyMessage = text || emptyMessage;
	} catch {
		emptyMessage = 'AWS CloudWatch não configurado no MCP server.';
	}

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
			<header>
				<h1 className="text-2xl font-semibold">Logs — AWS CloudWatch</h1>
				<p className="text-muted-foreground text-sm">Últimos {minutesAgo} minuto(s)</p>
			</header>

			<FilterForm
				action="/aws"
				values={{ filterPattern, logGroupName, since }}
				fields={[
					{ name: 'filterPattern', label: 'Filter pattern', type: 'text', placeholder: 'ERROR' },
					{ name: 'logGroupName', label: 'Log group', type: 'text', placeholder: '/aws/lambda/minha-funcao' },
					{ name: 'since', label: 'Desde (máx. 24h)', type: 'date' },
				]}
			/>

			{logs.length === 0 ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Timestamp</TableHead>
							<TableHead>Log Stream</TableHead>
							<TableHead>Mensagem</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{logs.map((log) => (
							<TableRow key={log.id}>
								<TableCell className="text-muted-foreground">{log.timestamp}</TableCell>
								<TableCell className="max-w-xs truncate">{log.logStreamName}</TableCell>
								<TableCell className="max-w-md truncate">
									<Link href={`/aws/${encodeURIComponent(log.id)}`} className="hover:underline">
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
