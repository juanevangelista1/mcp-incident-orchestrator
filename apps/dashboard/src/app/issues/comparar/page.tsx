import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue, ClarityInsights, Ga4Summary } from '@/lib/mcp-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { RouteComparisonExport } from '@/components/route-comparison-export';
import { PaginatedIssueList } from '@/components/paginated-issue-list';
import { RouteComparisonNarrativeAndExport } from '@/components/route-comparison-narrative-and-export';
import { GitCompare } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

type SearchParams = Promise<{ routeA?: string; routeB?: string }>;

interface RouteSnapshot {
	route: string;
	issues: SentryIssue[];
	totalOccurrences: number;
	clarity: ClarityInsights | null;
	clarityError: string | null;
	ga4: Ga4Summary | null;
}

// Busca Sentry (sempre) + Clarity + GA4 (melhor esforço — Clarity compartilha a mesma cota de
// 10/dia documentada em /insights; GA4 não tem esse teto, mas depende de credenciais
// configuradas). Se qualquer uma faltar, a comparação segue com o que tiver disponível.
async function fetchRouteSnapshot(route: string): Promise<RouteSnapshot> {
	const { data } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
		projectSlug: PROJECT_SLUG,
		route,
		limit: 100,
	});
	const issues = data?.issues ?? [];
	const totalOccurrences = issues.reduce((sum, i) => sum + i.count, 0);

	let clarity: ClarityInsights | null = null;
	let clarityError: string | null = null;
	try {
		const clarityResult = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3, url: route });
		clarity = clarityResult.data ?? null;
		if (!clarity) clarityError = clarityResult.text;
	} catch (error) {
		clarityError = error instanceof Error ? error.message : 'Clarity indisponível.';
	}

	let ga4: Ga4Summary | null = null;
	try {
		const ga4Result = await callMcpTool<Ga4Summary>('fetch_ga4_summary', { numOfDays: 7, pagePath: route });
		ga4 = ga4Result.data ?? null;
	} catch {
		// GA4 opcional (sem credenciais configuradas) não deve impedir o resto da comparação.
	}

	return { route, issues, totalOccurrences, clarity, clarityError, ga4 };
}

export default async function CompareRoutesPage({ searchParams }: { searchParams: SearchParams }) {
	const { routeA, routeB } = await searchParams;

	const [snapshotA, snapshotB] = await Promise.all([
		routeA ? fetchRouteSnapshot(routeA) : Promise.resolve(null),
		routeB ? fetchRouteSnapshot(routeB) : Promise.resolve(null),
	]);

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<PageTitle
				icon={GitCompare}
				accent="bg-rose-600/10 text-rose-600 dark:text-rose-400"
				title="Comparar rotas"
				subtitle={
					<p className="text-muted-foreground text-sm">
						Erros (Sentry) e comportamento (Clarity) de duas rotas lado a lado.
					</p>
				}
			/>

			<form method="get" action="/issues/comparar" className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
				<label className="flex flex-col gap-1 text-xs">
					<span className="text-muted-foreground">Rota A</span>
					<input
						type="text"
						name="routeA"
						defaultValue={routeA}
						placeholder="imovel/[id]/[slug]"
						className="focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					<span className="text-muted-foreground">Rota B</span>
					<input
						type="text"
						name="routeB"
						defaultValue={routeB}
						placeholder="agendamento-de-visita"
						className="focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
					/>
				</label>
				<button
					type="submit"
					className="focus-visible:ring-ring col-span-full rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:outline-none sm:col-span-1 sm:w-fit"
				>
					Comparar
				</button>
			</form>

			{!snapshotA && !snapshotB && (
				<p className="text-muted-foreground text-sm">
					Preencha as duas rotas acima (busca parcial, igual ao filtro de rota do Sentry — não
					precisa ser a URL inteira) para comparar.
				</p>
			)}

			{(snapshotA || snapshotB) && (
				<section className="grid gap-6 sm:grid-cols-2">
					<RouteCard snapshot={snapshotA} placeholder="Rota A" />
					<RouteCard snapshot={snapshotB} placeholder="Rota B" />
				</section>
			)}

			{snapshotA && snapshotB && (
				<RouteComparisonNarrativeAndExport snapshotA={snapshotA} snapshotB={snapshotB} />
			)}
		</main>
	);
}

function RouteCard({ snapshot, placeholder }: { snapshot: RouteSnapshot | null; placeholder: string }) {
	if (!snapshot) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-muted-foreground text-sm">{placeholder} não preenchida.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-t-4 border-t-rose-500/70">
			<CardHeader>
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="truncate" title={snapshot.route}>
						{snapshot.route}
					</CardTitle>
					<RouteComparisonExport
						route={snapshot.route}
						issues={snapshot.issues}
						totalOccurrences={snapshot.totalOccurrences}
						clarity={snapshot.clarity}
						ga4={snapshot.ga4}
					/>
				</div>
				<CardDescription>Sentry: is:unresolved, últimos resultados</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div>
						<p className="text-muted-foreground text-xs">Issues (Sentry)</p>
						<p className="text-xl font-semibold">{snapshot.issues.length}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Ocorrências</p>
						<p className="text-xl font-semibold">{snapshot.totalOccurrences}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Sessões (Clarity)</p>
						<p className="text-xl font-semibold">{snapshot.clarity?.totalSessions ?? '—'}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Erros de script (Clarity)</p>
						<p className="text-xl font-semibold">
							{snapshot.clarity ? `${snapshot.clarity.scriptErrorPercent}%` : '—'}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Sessões (GA4, real)</p>
						<p className="text-xl font-semibold">{snapshot.ga4?.sessions ?? '—'}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Conversões (GA4, real)</p>
						<p className="text-xl font-semibold">{snapshot.ga4?.conversions ?? '—'}</p>
					</div>
				</div>

				{snapshot.clarityError && (
					<p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
						Clarity: {snapshot.clarityError}
					</p>
				)}

				<div>
					<div className="mb-1 flex items-center justify-between gap-2">
						<h3 className="text-xs font-medium">Erros desta rota</h3>
						<Link
							href={`/issues?route=${encodeURIComponent(snapshot.route)}`}
							className="text-muted-foreground text-xs hover:underline"
						>
							Ver todos →
						</Link>
					</div>
					<PaginatedIssueList issues={snapshot.issues} />
				</div>
			</CardContent>
		</Card>
	);
}
