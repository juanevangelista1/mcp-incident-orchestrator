import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssueDetails } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function IssueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const data = await callMcpTool<SentryIssueDetails>('get_sentry_issue_details', { issueId: id })
		.then((result) => result.data)
		.catch(() => undefined);

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Link href="/issues" className="text-muted-foreground text-sm hover:underline">
				← Voltar para Issues
			</Link>

			{!data ? (
				<p className="text-muted-foreground text-sm">Não foi possível carregar os detalhes desse erro.</p>
			) : (
				<>
					<header>
						<h1 className="text-xl font-semibold">{data.errorMessage}</h1>
						<p className="text-muted-foreground text-sm">ID: {data.id}</p>
					</header>

					<Card>
						<CardHeader>
							<CardTitle>Stack Trace</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="overflow-x-auto text-xs whitespace-pre-wrap">
								{data.stackTrace.join('\n')}
							</pre>
						</CardContent>
					</Card>

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
