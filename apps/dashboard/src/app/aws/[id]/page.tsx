import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { AwsLogDetails } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AwsLogDetailsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const data = await callMcpTool<AwsLogDetails>('get_aws_log_details', { eventId: decodeURIComponent(id) })
		.then((result) => result.data)
		.catch(() => undefined);

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
			<Link href="/aws" className="text-muted-foreground text-sm hover:underline">
				← Voltar para AWS Logs
			</Link>

			{!data ? (
				<p className="text-muted-foreground text-sm">Não foi possível carregar os detalhes desse evento.</p>
			) : (
				<>
					<header>
						<h1 className="text-xl font-semibold">{data.message}</h1>
						<p className="text-muted-foreground text-sm">
							{data.logStreamName} · {data.timestamp}
						</p>
					</header>

					<Card>
						<CardHeader>
							<CardTitle>Contexto anterior</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="overflow-x-auto text-xs whitespace-pre-wrap">{data.tags.contextBefore}</pre>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Contexto posterior</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="overflow-x-auto text-xs whitespace-pre-wrap">{data.tags.contextAfter}</pre>
						</CardContent>
					</Card>
				</>
			)}
		</main>
	);
}
