import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue, ClarityInsights } from '@/lib/mcp-types';
import { classifySeverity, rankPagesByOccurrences, SEVERITY_BADGE_CLASS } from '@/lib/error-severity';

// Depende de uma conexão ao vivo com o MCP server — nunca pode ser pré-renderizada em
// build time (o servidor não existe/não está acessível durante o build, ex: no Vercel).
export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';
import { PageTitle } from '@/components/page-title';
import { MetricBar } from '@/components/metric-bar';
import { Pagination, PAGE_SIZE } from '@/components/pagination';
import { toQueryString } from '@/lib/query-string';
import { AlertTriangle } from 'lucide-react';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

const LEVEL_OPTIONS = [
	{ value: 'error', label: 'Error' },
	{ value: 'warning', label: 'Warning' },
	{ value: 'info', label: 'Info' },
	{ value: 'debug', label: 'Debug' },
	{ value: 'fatal', label: 'Fatal' },
];

type SearchParams = Promise<{
	environment?: string;
	route?: string;
	startDate?: string;
	endDate?: string;
	search?: string;
	level?: string;
	page?: string;
}>;

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
	const { environment, route, startDate, endDate, search, level, page: pageParam } = await searchParams;
	const page = Math.max(1, Number(pageParam) || 1);

	let allIssues: SentryIssue[] = [];
	let emptyMessage = 'Nenhum erro encontrado para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
			projectSlug: PROJECT_SLUG,
			environment,
			route,
			startDate,
			endDate,
			search,
			level,
			limit: 100,
		});
		allIssues = data?.issues ?? [];
		emptyMessage = text || emptyMessage;
	} catch (error: any) {
		emptyMessage = `Falha ao buscar issues: ${error.message}`;
	}

	const totalPages = Math.max(1, Math.ceil(allIssues.length / PAGE_SIZE));
	// Severidade é percentil sobre o CONJUNTO FILTRADO inteiro (allIssues), não sobre a página
	// exibida — senão o mesmo erro mudaria de classificação só por causa da paginação.
	const rankedAll = classifySeverity(allIssues);
	const severityById = new Map(rankedAll.map((r) => [r.id, r.severity]));
	const issues = allIssues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	// Ranking de páginas: Sentry (occurrences agrupadas por rota/culprit) cruzado com
	// scriptErrorsByPage do Clarity. Duas fontes, duas metodologias diferentes — nunca somadas,
	// sempre em colunas separadas (ver rationale na Fase E do plano).
	const sentryPageRank = rankPagesByOccurrences(allIssues, 8);
	let clarityScriptErrors: ClarityInsights['scriptErrorsByPage'] = [];
	try {
		const { data } = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3 });
		clarityScriptErrors = data?.scriptErrorsByPage ?? [];
	} catch {
		// Clarity opcional/indisponível não deve impedir a listagem de issues do Sentry.
	}

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={AlertTriangle}
					accent="bg-rose-600/10 text-rose-600 dark:text-rose-400"
					title="Issues — Sentry"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Projeto <Badge variant="outline">{PROJECT_SLUG || 'não configurado'}</Badge>
						</p>
					}
				/>
				<a
					href={`/api/export/issues${toQueryString({ environment, route, startDate, endDate, search, level })}`}
					className="focus-visible:ring-ring shrink-0 self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
				>
					Baixar CSV
				</a>
			</header>

			<FilterForm
				action="/issues"
				values={{ environment, route, startDate, endDate, search, level }}
				fields={[
					{ name: 'search', label: 'Busca (título/mensagem)', type: 'text', placeholder: 'TypeError' },
					{ name: 'level', label: 'Nível', type: 'select', options: LEVEL_OPTIONS },
					{ name: 'environment', label: 'Ambiente', type: 'text', placeholder: 'production' },
					{ name: 'route', label: 'Rota', type: 'text', placeholder: 'agendamento-visita' },
					{ name: 'startDate', label: 'De', type: 'date' },
					{ name: 'endDate', label: 'Até', type: 'date' },
				]}
			/>

			{issues.length === 0 ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				<>
					{/* Mobile: cards (uma coluna densa de tabela não cabe bem numa tela pequena). */}
					<div className="flex flex-col gap-3 md:hidden">
						{issues.map((issue) => (
							<Card key={issue.id}>
								<CardContent className="flex flex-col gap-2">
									<Link href={`/issues/${issue.id}`} className="text-sm font-medium hover:underline">
										{issue.title}
									</Link>
									<div className="flex items-center justify-between gap-2">
										<span title={issue.culprit} className="text-muted-foreground truncate text-xs">
											{issue.culprit}
										</span>
										<div className="flex items-center gap-1.5">
											<Badge className={SEVERITY_BADGE_CLASS[severityById.get(issue.id) ?? 'Baixo']}>
												{severityById.get(issue.id)}
											</Badge>
											<Badge variant="secondary">{issue.count}</Badge>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Desktop: tabela de verdade, com scroll horizontal como rede de segurança. */}
					<div className="hidden overflow-x-auto md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Título</TableHead>
									<TableHead>Rota / Culprit</TableHead>
									<TableHead>Severidade</TableHead>
									<TableHead className="text-right">Ocorrências</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{issues.map((issue) => (
									<TableRow key={issue.id}>
										<TableCell className="max-w-md truncate">
											<Link href={`/issues/${issue.id}`} title={issue.title} className="hover:underline">
												{issue.title}
											</Link>
										</TableCell>
										<TableCell title={issue.culprit} className="text-muted-foreground max-w-xs truncate">
											{issue.culprit}
										</TableCell>
										<TableCell>
											<Badge
												title="Heurística por percentil de ocorrências dentro deste conjunto filtrado — não é um campo oficial do Sentry."
												className={SEVERITY_BADGE_CLASS[severityById.get(issue.id) ?? 'Baixo']}
											>
												{severityById.get(issue.id)}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Badge variant="secondary">{issue.count}</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					<Pagination
						page={page}
						totalPages={totalPages}
						basePath="/issues"
						params={{ environment, route, startDate, endDate, search, level }}
					/>
				</>
			)}

			{allIssues.length > 0 && (
				<section className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardContent className="flex flex-col gap-3 pt-6">
							<div>
								<h2 className="text-sm font-medium">Ranking por página — Sentry</h2>
								<p className="text-muted-foreground text-xs">Ocorrências agrupadas por rota/culprit do erro</p>
							</div>
							{sentryPageRank.length > 0 ? (
								<div className="flex flex-col gap-1">
									{sentryPageRank.map((r, i) => (
										<MetricBar
											key={`${r.page}-${i}`}
											label={r.page}
											value={r.sentryOccurrences}
											max={sentryPageRank[0].sentryOccurrences}
											barColor="bg-rose-500/15"
										/>
									))}
								</div>
							) : (
								<p className="text-muted-foreground text-sm">Sem dados.</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardContent className="flex flex-col gap-3 pt-6">
							<div>
								<h2 className="text-sm font-medium">Ranking por página — Clarity</h2>
								<p className="text-muted-foreground text-xs">
									Erros de script (JS) detectados pelo Clarity, últimos 3 dias — fonte e metodologia
									diferentes do Sentry, colunas nunca somadas
								</p>
							</div>
							{clarityScriptErrors.length > 0 ? (
								<div className="flex flex-col gap-1">
									{clarityScriptErrors.map((p, i) => (
										<MetricBar
											key={`${p.url}-${i}`}
											label={p.url}
											value={p.count}
											max={clarityScriptErrors[0].count}
											barColor="bg-sky-500/15"
										/>
									))}
								</div>
							) : (
								<p className="text-muted-foreground text-sm">Sem dados (Clarity indisponível ou sem erros no período).</p>
							)}
						</CardContent>
					</Card>
				</section>
			)}
		</main>
	);
}
