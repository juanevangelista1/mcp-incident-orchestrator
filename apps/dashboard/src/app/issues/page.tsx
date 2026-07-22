import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue } from '@/lib/mcp-types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

export default async function IssuesPage() {
	let issues: SentryIssue[] = [];
	let emptyMessage = 'Nenhum erro encontrado.';
	try {
		const { data, text } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
			projectSlug: PROJECT_SLUG,
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
