import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue } from '@/lib/mcp-types';

// Depende de uma conexão ao vivo com o MCP server — nunca pode ser pré-renderizada em
// build time (o servidor não existe/não está acessível durante o build, ex: no Vercel).
export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';

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
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
			<header>
				<h1 className="text-2xl font-semibold">Issues — Sentry</h1>
				<p className="text-muted-foreground text-sm">
					Projeto <Badge variant="outline">{PROJECT_SLUG || 'não configurado'}</Badge>
				</p>
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
			)}
		</main>
	);
}
