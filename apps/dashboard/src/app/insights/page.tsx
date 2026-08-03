import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights } from '@/lib/mcp-types';
import { getGa4Summary } from '@/lib/mcp-summaries';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { PaginatedMetricList } from '@/components/paginated-metric-list';
import { ShareDonutChart } from '@/components/charts/share-donut-chart';
import { FilterForm } from '@/components/filter-form';
import { InsightsExport } from '@/components/insights-export';
import { MousePointerClick } from 'lucide-react';

type SearchParams = Promise<{ url?: string; device?: string; days?: string }>;

const DAYS_OPTIONS = [
	{ value: '1', label: '1 dia' },
	{ value: '2', label: '2 dias' },
	{ value: '3', label: '3 dias (máximo da API)' },
];

// Opções fixas em vez de texto livre: cada valor digitado à mão vira uma cota nova gasta na
// API do Clarity (a chave de cache é a combinação exata de numOfDays/url/device). Com um
// conjunto pequeno e conhecido de combinações, dá pra estimar o gasto de cota — texto livre
// deixava isso ilimitado.
// O valor tem que ser o que a própria API do Clarity devolve na dimensão Device — confirmado
// ao vivo que ela usa "PC" para desktop (não "Desktop"), senão o filtro nunca bate com
// nenhuma linha e volta sempre 0 sessões. O rótulo continua "Desktop" pro usuário.
const DEVICE_OPTIONS = [
	{ value: 'PC', label: 'Desktop' },
	{ value: 'Mobile', label: 'Mobile' },
	{ value: 'Tablet', label: 'Tablet' },
];

const BOOKING_URL_PATTERN = process.env.CLARITY_BOOKING_URL_PATTERN ?? '';
const PAGE_OPTIONS = BOOKING_URL_PATTERN
	? [{ value: BOOKING_URL_PATTERN, label: 'Página de agendamento' }]
	: [];

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
	const { url, device, days } = await searchParams;
	// A API pública do Clarity só aceita 1-3 dias por chamada — não existe "7 dias" ou "30
	// dias" aqui. Pra janelas maiores, use a página /reports (dados históricos já persistidos,
	// sem gastar cota nova do Clarity).
	const numOfDays = Math.min(3, Math.max(1, Number(days) || 3));

	let data: ClarityInsights | undefined;
	let emptyMessage = 'Clarity não configurado no MCP server.';
	try {
		const result = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays, url, device });
		data = result.data;
		emptyMessage = result.text || emptyMessage;
	} catch (error: any) {
		emptyMessage = error.message;
	}

	// Conversão REAL do GA4 (não é proxy como o resto desta página) — mesma função já usada
	// pelo digest diário. `null` sem gastar cota se o plugin não estiver configurado.
	const ga4 = await getGa4Summary();

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={MousePointerClick}
					accent="bg-sky-600/10 text-sky-600 dark:text-sky-400"
					title="Insights — Microsoft Clarity"
					subtitle={<p className="text-muted-foreground text-sm">Últimos {numOfDays} dia(s)</p>}
				/>
				{data && <InsightsExport data={data} numOfDays={numOfDays} urlFilter={url} deviceFilter={device} ga4={ga4} />}
			</header>

			<FilterForm
				action="/insights"
				values={{ days, url, device }}
				fields={[
					{ name: 'days', label: 'Janela de dias', type: 'select', options: DAYS_OPTIONS },
					{ name: 'device', label: 'Dispositivo', type: 'select', options: DEVICE_OPTIONS },
					...(PAGE_OPTIONS.length > 0
						? [{ name: 'url', label: 'Página', type: 'select' as const, options: PAGE_OPTIONS }]
						: []),
				]}
			/>
			<p className="text-muted-foreground -mt-3 text-xs">
				Filtros fixos (não texto livre): cada combinação diferente consome uma cota da API do
				Clarity na primeira vez (limite: 10 requisições/dia) — resultados ficam em cache por 6h
				depois disso.
			</p>

			{!data ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					<section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
						<Card size="sm" className="border-t-4 border-t-sky-500/70">
							<CardHeader>
								<CardDescription>Sessões</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.totalSessions}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-amber-500/70">
							<CardHeader>
								<CardDescription>Cliques contínuos (rage)</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.rageClickPercent}%</CardTitle>
								<p className="text-muted-foreground text-xs">{data.rageClicks} sessão(ões)</p>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-orange-500/70">
							<CardHeader>
								<CardDescription>Cliques mortos (dead)</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.deadClickPercent}%</CardTitle>
								<p className="text-muted-foreground text-xs">{data.deadClicks} sessão(ões)</p>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-rose-500/70">
							<CardHeader>
								<CardDescription>Erros de script</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.scriptErrorPercent}%</CardTitle>
								<p className="text-muted-foreground text-xs">{data.scriptErrors} sessão(ões)</p>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-violet-500/70">
							<CardHeader>
								<CardDescription>Rolagem excessiva</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.excessiveScrollPercent}%</CardTitle>
								<p className="text-muted-foreground text-xs">{data.excessiveScrollSessions} sessão(ões)</p>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-indigo-500/70">
							<CardHeader>
								<CardDescription>Retornos rápidos</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{data.quickBackPercent}%</CardTitle>
								<p className="text-muted-foreground text-xs">{data.quickBackSessions} sessão(ões)</p>
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
							<PaginatedMetricList
								items={data.topPages.map((p) => ({
									label: p.url,
									value: p.sessions,
									href: `/insights?url=${encodeURIComponent(p.url)}`,
								}))}
								barColor="bg-sky-500/15"
								emptyMessage="Nenhuma página encontrada para esse filtro."
							/>
						</CardContent>
					</Card>

					<section className="grid gap-6 md:grid-cols-3">
						<Card className="border-t-4 border-t-amber-500/70">
							<CardHeader>
								<CardTitle>Rage clicks por página</CardTitle>
								<CardDescription>Onde os usuários mais clicam repetidamente com frustração</CardDescription>
							</CardHeader>
							<CardContent>
								<PaginatedMetricList
									items={data.rageClicksByPage.map((p) => ({
										label: p.url,
										value: p.count,
										href: `/insights?url=${encodeURIComponent(p.url)}`,
									}))}
									barColor="bg-amber-500/15"
									emptyMessage="Nenhum rage click encontrado."
								/>
							</CardContent>
						</Card>

						<Card className="border-t-4 border-t-orange-500/70">
							<CardHeader>
								<CardTitle>Dead clicks por página</CardTitle>
								<CardDescription>Onde os usuários clicam em algo que não responde</CardDescription>
							</CardHeader>
							<CardContent>
								<PaginatedMetricList
									items={data.deadClicksByPage.map((p) => ({
										label: p.url,
										value: p.count,
										href: `/insights?url=${encodeURIComponent(p.url)}`,
									}))}
									barColor="bg-orange-500/15"
									emptyMessage="Nenhum dead click encontrado."
								/>
							</CardContent>
						</Card>

						<Card className="border-t-4 border-t-rose-500/70">
							<CardHeader>
								<CardTitle>Erros de script por página</CardTitle>
								<CardDescription>Onde o Clarity registrou mais erros de JavaScript</CardDescription>
							</CardHeader>
							<CardContent>
								<PaginatedMetricList
									items={data.scriptErrorsByPage.map((p) => ({
										label: p.url,
										value: p.count,
										href: `/insights?url=${encodeURIComponent(p.url)}`,
									}))}
									barColor="bg-rose-500/15"
									emptyMessage="Nenhum erro de script encontrado."
								/>
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

			<Card className="border-t-4 border-t-teal-500/70">
				<CardHeader>
					<CardTitle>Conversão real — Google Analytics 4</CardTitle>
					<CardDescription>
						Diferente do resto desta página (comportamento/proxy do Clarity), estes números são a
						conversão REAL de um evento específico do GA4 — nunca some com sessões do Clarity.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{ga4 ? (
						<div className="flex flex-col gap-4">
							<div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
								<div>
									<p className="text-muted-foreground text-xs">Sessões (GA4)</p>
									<p className="text-xl font-semibold">{ga4.sessions}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Usuários (GA4)</p>
									<p className="text-xl font-semibold">{ga4.totalUsers}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">
										Conversões{ga4.conversionEventName ? ` (${ga4.conversionEventName})` : ''}
									</p>
									<p className="text-xl font-semibold">{ga4.conversions ?? '—'}</p>
								</div>
							</div>
							{ga4.topPagesBySessions.length > 0 && (
								<div>
									<h3 className="mb-1 text-xs font-medium">Páginas mais visitadas (GA4)</h3>
									<PaginatedMetricList
										items={ga4.topPagesBySessions.map((p) => ({ label: p.page, value: p.sessions }))}
										barColor="bg-teal-500/15"
									/>
								</div>
							)}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							GA4 não configurado no MCP server (<code>GA4_PROPERTY_ID</code>/<code>GA4_CLIENT_EMAIL</code>/
							<code>GA4_PRIVATE_KEY</code>).
						</p>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
