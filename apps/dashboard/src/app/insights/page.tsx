import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { MetricBar } from '@/components/metric-bar';
import { ShareDonutChart } from '@/components/charts/share-donut-chart';
import { MousePointerClick } from 'lucide-react';

type SearchParams = Promise<{ url?: string }>;

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
	const { url } = await searchParams;

	let data: ClarityInsights | undefined;
	let emptyMessage = 'Clarity não configurado no MCP server.';
	try {
		const result = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3, url });
		data = result.data;
		emptyMessage = result.text || emptyMessage;
	} catch (error: any) {
		emptyMessage = error.message;
	}

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={MousePointerClick}
					accent="bg-sky-600/10 text-sky-600 dark:text-sky-400"
					title="Insights — Microsoft Clarity"
					subtitle={<p className="text-muted-foreground text-sm">Últimos 3 dias</p>}
				/>
				{url && (
					<a
						href="/insights"
						className="focus-visible:ring-ring text-muted-foreground shrink-0 self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
					>
						Filtrado por &quot;{url}&quot; — limpar
					</a>
				)}
			</header>

			{!data ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					<section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
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
						<Card
							size="sm"
							className="border-t-4 border-t-slate-500/70"
							title="Estimativa nossa (sessões com tempo ativo zerado), não é um dado oficial de detecção de bot do Clarity — a API pública dele não expõe isso."
						>
							<CardHeader>
								<CardDescription>Baixo engajamento (estimativa)</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.lowEngagementSessions}</CardTitle>
							</CardHeader>
						</Card>
					</section>

					<Card className="border-t-4 border-t-sky-500/70">
						<CardHeader>
							<CardTitle>Páginas mais visitadas</CardTitle>
						</CardHeader>
						<CardContent>
							{data.topPages.length > 0 ? (
								<div className="flex flex-col gap-1">
									{data.topPages.map((page, i) => (
										<a key={`${page.url}-${i}`} href={`/insights?url=${encodeURIComponent(page.url)}`} className="block rounded-md hover:bg-accent/60">
											<MetricBar
												label={page.url}
												value={page.sessions}
												max={data.topPages[0].sessions}
												barColor="bg-sky-500/15"
											/>
										</a>
									))}
								</div>
							) : (
								<p className="text-muted-foreground text-sm">Nenhuma página encontrada para esse filtro.</p>
							)}
						</CardContent>
					</Card>

					<section className="grid gap-6 md:grid-cols-3">
						<Card className="border-t-4 border-t-amber-500/70">
							<CardHeader>
								<CardTitle>Rage clicks por página</CardTitle>
								<CardDescription>Onde os usuários mais clicam repetidamente com frustração</CardDescription>
							</CardHeader>
							<CardContent>
								{data.rageClicksByPage.length > 0 ? (
									<div className="flex flex-col gap-1">
										{data.rageClicksByPage.map((p, i) => (
											<a key={`${p.url}-${i}`} href={`/insights?url=${encodeURIComponent(p.url)}`} className="block rounded-md hover:bg-accent/60">
												<MetricBar
													label={p.url}
													value={p.count}
													max={data.rageClicksByPage[0].count}
													barColor="bg-amber-500/15"
												/>
											</a>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">Nenhum rage click encontrado.</p>
								)}
							</CardContent>
						</Card>

						<Card className="border-t-4 border-t-orange-500/70">
							<CardHeader>
								<CardTitle>Dead clicks por página</CardTitle>
								<CardDescription>Onde os usuários clicam em algo que não responde</CardDescription>
							</CardHeader>
							<CardContent>
								{data.deadClicksByPage.length > 0 ? (
									<div className="flex flex-col gap-1">
										{data.deadClicksByPage.map((p, i) => (
											<a key={`${p.url}-${i}`} href={`/insights?url=${encodeURIComponent(p.url)}`} className="block rounded-md hover:bg-accent/60">
												<MetricBar
													label={p.url}
													value={p.count}
													max={data.deadClicksByPage[0].count}
													barColor="bg-orange-500/15"
												/>
											</a>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">Nenhum dead click encontrado.</p>
								)}
							</CardContent>
						</Card>

						<Card className="border-t-4 border-t-rose-500/70">
							<CardHeader>
								<CardTitle>Erros de script por página</CardTitle>
								<CardDescription>Onde o Clarity registrou mais erros de JavaScript</CardDescription>
							</CardHeader>
							<CardContent>
								{data.scriptErrorsByPage.length > 0 ? (
									<div className="flex flex-col gap-1">
										{data.scriptErrorsByPage.map((p, i) => (
											<a key={`${p.url}-${i}`} href={`/insights?url=${encodeURIComponent(p.url)}`} className="block rounded-md hover:bg-accent/60">
												<MetricBar
													label={p.url}
													value={p.count}
													max={data.scriptErrorsByPage[0].count}
													barColor="bg-rose-500/15"
												/>
											</a>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">Nenhum erro de script encontrado.</p>
								)}
							</CardContent>
						</Card>
					</section>

					<section className="grid gap-6 md:grid-cols-2">
						<Card className="border-t-4 border-t-sky-500/70">
							<CardHeader>
								<CardTitle>Sessões por dispositivo</CardTitle>
							</CardHeader>
							<CardContent>
								<ShareDonutChart data={data.sessionsByDevice.map((d) => ({ name: d.device, value: d.count }))} />
							</CardContent>
						</Card>

						<Card className="border-t-4 border-t-sky-500/70">
							<CardHeader>
								<CardTitle>Sessões por navegador</CardTitle>
							</CardHeader>
							<CardContent>
								<ShareDonutChart data={data.sessionsByBrowser.map((b) => ({ name: b.browser, value: b.count }))} />
							</CardContent>
						</Card>
					</section>
				</>
			)}
		</main>
	);
}
