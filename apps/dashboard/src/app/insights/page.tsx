import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights } from '@/lib/mcp-types';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function InsightsPage() {
	let data: ClarityInsights | undefined;
	let emptyMessage = 'Clarity não configurado no MCP server.';
	try {
		const result = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3 });
		data = result.data;
		emptyMessage = result.text || emptyMessage;
	} catch (error: any) {
		emptyMessage = error.message;
	}

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header>
				<h1 className="text-xl font-semibold sm:text-2xl">Insights — Microsoft Clarity</h1>
				<p className="text-muted-foreground text-sm">Últimos 3 dias</p>
			</header>

			{!data ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					<section className="grid grid-cols-2 gap-4 md:grid-cols-4">
						<Card size="sm">
							<CardHeader>
								<CardDescription>Sessões</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.totalSessions}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm">
							<CardHeader>
								<CardDescription>Rage clicks</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.rageClicks}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm">
							<CardHeader>
								<CardDescription>Dead clicks</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.deadClicks}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm">
							<CardHeader>
								<CardDescription>Erros de script</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.scriptErrors}</CardTitle>
							</CardHeader>
						</Card>
					</section>

					<Card>
						<CardHeader>
							<CardTitle>Páginas mais visitadas</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="flex flex-col gap-2 text-sm">
								{data.topPages.map((page, i) => (
									<li key={`${page.url}-${i}`} className="flex items-center justify-between gap-4">
										<span className="truncate text-muted-foreground">{page.url}</span>
										<Badge variant="secondary">{page.sessions}</Badge>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				</>
			)}
		</main>
	);
}
