import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { DatadogLogDetails } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LogDetailsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const data = await callMcpTool<DatadogLogDetails>('get_datadog_log_details', { logId: id })
		.then((result) => result.data)
		.catch(() => undefined);

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Link href="/logs" className="text-muted-foreground text-sm hover:underline">
				← Voltar para Logs
			</Link>

			{!data ? (
				<p className="text-muted-foreground text-sm">Não foi possível carregar os detalhes desse log.</p>
			) : (
				<>
					<header>
						<h1 className="text-xl font-semibold">{data.message}</h1>
						<p className="text-muted-foreground text-sm">
							{data.service} · {data.status} · {data.host} · {data.timestamp}
						</p>
					</header>

					<Card>
						<CardHeader>
							<CardTitle>Tags</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="overflow-x-auto text-xs">{JSON.stringify(data.tags, null, 2)}</pre>
						</CardContent>
					</Card>
				</>
			)}
		</main>
	);
}
