import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue, ClarityInsights } from '@/lib/mcp-types';
import { classifySeverity, rankPagesByOccurrences, SEVERITY_BADGE_CLASS, Severity } from '@/lib/error-severity';

// Depende de uma conexão ao vivo com o MCP server — nunca pode ser pré-renderizada em
// build time (o servidor não existe/não está acessível durante o build, ex: no Vercel).
export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';
import { PageTitle } from '@/components/page-title';
import { PaginatedMetricList } from '@/components/paginated-metric-list';
import { IssuesExport } from '@/components/issues-export';
import { Pagination, PAGE_SIZE } from '@/components/pagination';
import { toQueryString } from '@/lib/query-string';
import { rangeIncludesToday } from '@/lib/date-format';
import { formatNumberBR } from '@/lib/format';
import { TodayDelayWarning } from '@/components/today-delay-warning';
import { AlertTriangle, ArrowUpDown } from 'lucide-react';

const SEVERITY_RANK: Record<Severity, number> = { Crítico: 4, Alto: 3, Médio: 2, Baixo: 1 };
const SEVERITY_OPTIONS = [
	{ value: 'Crítico', label: 'Crítico' },
	{ value: 'Alto', label: 'Alto' },
	{ value: 'Médio', label: 'Médio' },
	{ value: 'Baixo', label: 'Baixo' },
];
type SortKey = 'title' | 'severity' | 'count' | 'lastSeen';
const SORT_KEYS: SortKey[] = ['title', 'severity', 'count', 'lastSeen'];

const DATE_FIELD_OPTIONS = [
	{ value: 'lastSeen', label: 'Ocorreu no período' },
	{ value: 'firstSeen', label: 'Apareceu pela primeira vez no período' },
];

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
	dateField?: string;
	search?: string;
	level?: string;
	severity?: string;
	page?: string;
	sort?: string;
	dir?: string;
}>;

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
	const { environment, route, startDate, endDate, dateField, search, level, severity, page: pageParam, sort, dir } =
		await searchParams;
	const page = Math.max(1, Number(pageParam) || 1);
	const sortKey: SortKey = SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'lastSeen';
	const sortDir: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';
	const effectiveDateField = dateField === 'firstSeen' ? 'firstSeen' : 'lastSeen';

	let allIssues: SentryIssue[] = [];
	let emptyMessage = 'Nenhum erro encontrado para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
			projectSlug: PROJECT_SLUG,
			environment,
			route,
			startDate,
			endDate,
			dateField: effectiveDateField,
			search,
			level,
			limit: 100,
		});
		allIssues = data?.issues ?? [];
		emptyMessage = text || emptyMessage;
	} catch (error: any) {
		emptyMessage = `Falha ao buscar issues: ${error.message}`;
	}

	// Severidade é percentil sobre o CONJUNTO FILTRADO PELO SENTRY inteiro (allIssues), antes do
	// filtro de severidade — senão selecionar "Crítico" reduziria o próprio universo usado pra
	// calcular o percentil, e o resultado deixaria de ser comparável com o que aparece sem filtro.
	const rankedAll = classifySeverity(allIssues);
	const severityById = new Map(rankedAll.map((r) => [r.id, r.severity]));

	const severityFilteredIssues = severity
		? allIssues.filter((issue) => severityById.get(issue.id) === severity)
		: allIssues;
	const totalPages = Math.max(1, Math.ceil(severityFilteredIssues.length / PAGE_SIZE));

	// Ordena o conjunto inteiro (não só a página exibida) antes de fatiar — senão trocar de
	// página no meio de uma ordenação por título, por exemplo, ficaria inconsistente.
	const sortedIssues = [...severityFilteredIssues].sort((a, b) => {
		let cmp: number;
		if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
		else if (sortKey === 'severity') {
			cmp = SEVERITY_RANK[severityById.get(a.id) ?? 'Baixo'] - SEVERITY_RANK[severityById.get(b.id) ?? 'Baixo'];
		} else if (sortKey === 'lastSeen') cmp = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
		else cmp = a.count - b.count;
		return sortDir === 'asc' ? cmp : -cmp;
	});
	const issues = sortedIssues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	// Ranking de páginas: Sentry (occurrences agrupadas por rota/culprit) cruzado com
	// scriptErrorsByPage do Clarity. Duas fontes, duas metodologias diferentes — nunca somadas,
	// sempre em colunas separadas (ver rationale na Fase E do plano).
	const sentryPageRank = rankPagesByOccurrences(allIssues, 50);
	let clarityScriptErrors: ClarityInsights['scriptErrorsByPage'] = [];
	try {
		const { data } = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3 });
		clarityScriptErrors = data?.scriptErrorsByPage ?? [];
	} catch {
		// Clarity opcional/indisponível não deve impedir a listagem de issues do Sentry.
	}

	// Clicar numa coluna já ordenada por ela inverte a direção; clicar numa coluna nova ordena
	// desc por padrão. Reseta pra página 1 — a página atual pode nem existir mais na nova ordem.
	const sortHref = (key: SortKey) => {
		const nextDir = sortKey === key && sortDir === 'desc' ? 'asc' : 'desc';
		return `/issues${toQueryString({ environment, route, startDate, endDate, dateField, search, level, severity, sort: key, dir: nextDir })}`;
	};
	const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : '');

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={AlertTriangle}
					accent="bg-rose-600/10 text-rose-600 dark:text-rose-400"
					title="Issues do Sentry"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Projeto <Badge variant="outline">{PROJECT_SLUG || 'não configurado'}</Badge>
						</p>
					}
				/>
				<div className="flex shrink-0 gap-2">
					<a
						href={`/api/export/issues${toQueryString({ environment, route, startDate, endDate, dateField, search, level })}`}
						className="focus-visible:ring-ring self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
					>
						Baixar CSV
					</a>
					<IssuesExport
						issues={severityFilteredIssues}
						rankedIssues={rankedAll}
						pageRank={sentryPageRank}
						clarityScriptErrors={clarityScriptErrors}
						filters={{ environment, route, startDate, endDate, search, level, severity }}
					/>
				</div>
			</header>

			<FilterForm
				action="/issues"
				values={{ environment, route, startDate, endDate, dateField: effectiveDateField, search, level, severity }}
				fields={[
					{ name: 'search', label: 'Busca (título/mensagem)', type: 'text', placeholder: 'TypeError' },
					{ name: 'level', label: 'Nível', type: 'select', options: LEVEL_OPTIONS },
					{ name: 'severity', label: 'Severidade', type: 'select', options: SEVERITY_OPTIONS },
					{ name: 'environment', label: 'Ambiente', type: 'text', placeholder: 'production' },
					{ name: 'route', label: 'Rota', type: 'text', placeholder: 'agendamento-visita' },
					{ name: 'startDate', label: 'De', type: 'date' },
					{ name: 'endDate', label: 'Até', type: 'date' },
					{ name: 'dateField', label: 'Modo de data', type: 'select', options: DATE_FIELD_OPTIONS },
				]}
			/>
			<p className="text-muted-foreground -mt-3 text-xs">
				&quot;Ocorreu no período&quot; (padrão) mostra erros que dispararam nesse intervalo, mesmo
				que tenham surgido antes. &quot;Apareceu pela primeira vez&quot; mostra só erros novos,
				criados dentro do período.
			</p>

			{rangeIncludesToday(endDate) && <TodayDelayWarning />}

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
											<Badge variant="secondary">{formatNumberBR(issue.count)}</Badge>
										</div>
									</div>
									<span className="text-muted-foreground text-xs">
										última vez {new Date(issue.lastSeen).toLocaleString('pt-BR')}
									</span>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Desktop: tabela de verdade, com scroll horizontal como rede de segurança. */}
					<div className="hidden overflow-x-auto md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<Link href={sortHref('title')} className="inline-flex items-center gap-1 hover:underline">
											Título <ArrowUpDown className="size-3" /> {sortIndicator('title')}
										</Link>
									</TableHead>
									<TableHead>Rota / Culprit</TableHead>
									<TableHead>
										<Link href={sortHref('severity')} className="inline-flex items-center gap-1 hover:underline">
											Severidade <ArrowUpDown className="size-3" /> {sortIndicator('severity')}
										</Link>
									</TableHead>
									<TableHead className="text-right">
										<Link href={sortHref('count')} className="inline-flex items-center justify-end gap-1 hover:underline">
											Ocorrências <ArrowUpDown className="size-3" /> {sortIndicator('count')}
										</Link>
									</TableHead>
									<TableHead>
										<Link href={sortHref('lastSeen')} className="inline-flex items-center gap-1 hover:underline">
											Última ocorrência <ArrowUpDown className="size-3" /> {sortIndicator('lastSeen')}
										</Link>
									</TableHead>
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
												title="Heurística por percentil de ocorrências dentro deste conjunto filtrado. Não é um campo oficial do Sentry."
												className={SEVERITY_BADGE_CLASS[severityById.get(issue.id) ?? 'Baixo']}
											>
												{severityById.get(issue.id)}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Badge variant="secondary">{formatNumberBR(issue.count)}</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{new Date(issue.lastSeen).toLocaleString('pt-BR')}
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
						params={{ environment, route, startDate, endDate, dateField, search, level, severity, sort: sortKey, dir: sortDir }}
					/>
				</>
			)}

			{allIssues.length > 0 && (
				<section className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardContent className="flex flex-col gap-3 pt-6">
							<div className="flex items-center justify-between gap-2">
								<div>
									<h2 className="text-sm font-medium">Ranking por página: Sentry</h2>
									<p className="text-muted-foreground text-xs">Ocorrências agrupadas por rota/culprit do erro</p>
								</div>
								{sentryPageRank.length >= 2 && (
									<Link
										href={`/issues/comparar?routeA=${encodeURIComponent(sentryPageRank[0].page)}&routeB=${encodeURIComponent(sentryPageRank[1].page)}`}
										className="text-muted-foreground shrink-0 text-xs hover:underline"
									>
										Comparar top 2 →
									</Link>
								)}
							</div>
							<PaginatedMetricList
								items={sentryPageRank.map((r) => ({
									label: r.page,
									value: r.sentryOccurrences,
									href: `/issues?route=${encodeURIComponent(r.page)}`,
								}))}
								barColor="bg-rose-500/15"
								emptyMessage="Sem dados."
							/>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="flex flex-col gap-3 pt-6">
							<div>
								<h2 className="text-sm font-medium">Ranking por página: Clarity</h2>
								<p className="text-muted-foreground text-xs">
									Erros de script (JS) detectados pelo Clarity, últimos 3 dias. Fonte e metodologia
									diferentes do Sentry, colunas nunca somadas
								</p>
							</div>
							<PaginatedMetricList
								items={clarityScriptErrors.map((p) => ({
									label: p.url,
									value: p.count,
									href: `/insights?url=${encodeURIComponent(p.url)}`,
								}))}
								barColor="bg-sky-500/15"
								emptyMessage="Sem dados (Clarity indisponível ou sem erros no período)."
							/>
						</CardContent>
					</Card>
				</section>
			)}
		</main>
	);
}
