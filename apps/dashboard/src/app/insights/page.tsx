import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { MetricBar } from '@/components/metric-bar';
import { MousePointerClick } from 'lucide-react';

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
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header>
				<PageTitle
					icon={MousePointerClick}
					accent="bg-sky-600/10 text-sky-600 dark:text-sky-400"
					title="Insights — Microsoft Clarity"
					subtitle={<p className="text-muted-foreground text-sm">Últimos 3 dias</p>}
				/>
			</header>

			{!data ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					<section className="grid grid-cols-2 gap-4 md:grid-cols-4">
						<Card size="sm" className="border-t-4 border-t-sky-500/70">
							<CardHeader>
								<CardDescription>Sessões</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.totalSessions}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-amber-500/70">
							<CardHeader>
								<CardDescription>Rage clicks</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.rageClicks}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-orange-500/70">
							<CardHeader>
								<CardDescription>Dead clicks</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.deadClicks}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-rose-500/70">
							<CardHeader>
								<CardDescription>Erros de script</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.scriptErrors}</CardTitle>
							</CardHeader>
						</Card>
					</section>

					<Card className="border-t-4 border-t-sky-500/70">
						<CardHeader>
							<CardTitle>Páginas mais visitadas</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col gap-1">
								{data.topPages.map((page, i) => (
									<MetricBar
										key={`${page.url}-${i}`}
										label={page.url}
										value={page.sessions}
										max={data.topPages[0].sessions}
										barColor="bg-sky-500/15"
									/>
								))}
							</div>
						</CardContent>
					</Card>
				</>
			)}
		</main>
	);
}
