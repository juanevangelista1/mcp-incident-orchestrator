import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue } from '@/lib/mcp-types';

// Depende de uma conexão ao vivo com o MCP server — nunca pode ser pré-renderizada em
// build time (o servidor não existe/não está acessível durante o build, ex: no Vercel).
export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';
import { PageTitle } from '@/components/page-title';
import { toQueryString } from '@/lib/query-string';
import { AlertTriangle } from 'lucide-react';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

type SearchParams = Promise<{ environment?: string; route?: string; startDate?: string; endDate?: string }>;

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
	const { environment, route, startDate, endDate } = await searchParams;

	let issues: SentryIssue[] = [];
	let emptyMessage = 'Nenhum erro encontrado para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
			projectSlug: PROJECT_SLUG,
			environment,
			route,
			startDate,
			endDate,
			limit: 20,
		});
		issues = data?.issues ?? [];
		emptyMessage = text || emptyMessage;
	} catch (error: any) {
		emptyMessage = `Falha ao buscar issues: ${error.message}`;
	}

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
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
					href={`/api/export/issues${toQueryString({ environment, route, startDate, endDate })}`}
					className="shrink-0 self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
				>
					Baixar CSV
				</a>
			</header>

			<FilterForm
				action="/issues"
				values={{ environment, route, startDate, endDate }}
				fields={[
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
										<span className="text-muted-foreground truncate text-xs">{issue.culprit}</span>
										<Badge variant="secondary">{issue.count}</Badge>
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
									<TableHead className="text-right">Ocorrências</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{issues.map((issue) => (
									<TableRow key={issue.id}>
										<TableCell className="max-w-md truncate">
											<Link href={`/issues/${issue.id}`} className="hover:underline">
												{issue.title}
											</Link>
										</TableCell>
										<TableCell className="text-muted-foreground max-w-xs truncate">{issue.culprit}</TableCell>
										<TableCell className="text-right">
											<Badge variant="secondary">{issue.count}</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</>
			)}
		</main>
	);
}
