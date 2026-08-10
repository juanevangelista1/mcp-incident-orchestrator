import Link from 'next/link';
import { callMcpTool } from '@/lib/mcp-client';
import { DatadogErrorIssue } from '@/lib/mcp-types';
import { dateToMinutesAgo } from '@/lib/date-range';

export const dynamic = 'force-dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { FilterForm } from '@/components/filter-form';
import { PageTitle } from '@/components/page-title';
import { Pagination, PAGE_SIZE } from '@/components/pagination';
import { Bug } from 'lucide-react';

// Error Tracking agrupa erros de APM/RUM em "issues" — único produto Datadog integrado
// aqui (Logs não é usado: a conta não tem log source configurado no onboarding do Datadog).
type SearchParams = Promise<{
	query?: string;
	since?: string;
	page?: string;
}>;

const STATE_BADGE_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
	OPEN: 'destructive',
	ACKNOWLEDGED: 'secondary',
	RESOLVED: 'outline',
	IGNORED: 'outline',
	EXCLUDED: 'outline',
};

export default async function ErrorTrackingPage({ searchParams }: { searchParams: SearchParams }) {
	const { query, since, page: pageParam } = await searchParams;
	const minutesAgo = dateToMinutesAgo(since);
	const page = Math.max(1, Number(pageParam) || 1);

	let allIssues: DatadogErrorIssue[] = [];
	let emptyMessage = 'Nenhuma issue encontrada para esse filtro.';
	try {
		const { data, text } = await callMcpTool<{ issues: DatadogErrorIssue[] }>(
			'fetch_datadog_error_issues',
			{
				query,
				minutesAgo,
				limit: 50,
			},
		);
		allIssues = data?.issues ?? [];
		emptyMessage = text || emptyMessage;
	} catch {
		emptyMessage = 'Datadog não configurado no MCP server.';
	}

	const totalPages = Math.max(1, Math.ceil(allIssues.length / PAGE_SIZE));
	const issues = allIssues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return (
		<main
			id='main-content'
			className='mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8'>
			<header className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
				<PageTitle
					icon={Bug}
					accent='bg-orange-600/10 text-orange-600 dark:text-orange-400'
					title='Error Tracking - Datadog'
					subtitle={
						<p className='text-muted-foreground text-sm'>
							Últimas {minutesAgo} minuto(s), ordenado por volume
						</p>
					}
				/>
			</header>

			<FilterForm
				action='/error-tracking'
				values={{ query, since }}
				fields={[
					{
						name: 'query',
						label: 'Busca (formato Datadog)',
						type: 'text',
						placeholder: 'service:lello-web env:production',
					},
					{ name: 'since', label: 'Desde (máx. 24h)', type: 'date' },
				]}
			/>

			{issues.length === 0 ? (
				<p className='text-muted-foreground text-sm'>{emptyMessage}</p>
			) : (
				<>
					<div className='flex flex-col gap-3 md:hidden'>
						{issues.map((issue) => (
							<Link key={issue.id} href={`/error-tracking/${issue.id}`} className='block'>
								<Card className='transition-colors hover:bg-accent/40'>
									<CardContent className='flex flex-col gap-2'>
										<div className='flex items-center justify-between gap-2'>
											<Badge variant={STATE_BADGE_VARIANT[issue.state] ?? 'outline'}>{issue.state}</Badge>
											<span className='text-muted-foreground text-xs'>{issue.totalCount}x</span>
										</div>
										<p
											title={issue.errorMessage}
											className='line-clamp-2 text-sm font-medium'>
											{issue.errorType}: {issue.errorMessage}
										</p>
										<span className='text-muted-foreground text-xs'>
											{issue.service} · última vez {new Date(issue.lastSeen).toLocaleString('pt-BR')}
										</span>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>

					<div className='hidden overflow-x-auto md:block'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Serviço</TableHead>
									<TableHead>Erro</TableHead>
									<TableHead>Estado</TableHead>
									<TableHead>Última ocorrência</TableHead>
									<TableHead className='text-right'>Ocorrências</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{issues.map((issue) => (
									<TableRow key={issue.id}>
										<TableCell>{issue.service}</TableCell>
										<TableCell
											title={issue.errorMessage}
											className='max-w-md truncate'>
											<Link href={`/error-tracking/${issue.id}`} className='hover:underline'>
												<span className='font-medium'>{issue.errorType}</span>: {issue.errorMessage}
											</Link>
										</TableCell>
										<TableCell>
											<Badge variant={STATE_BADGE_VARIANT[issue.state] ?? 'outline'}>{issue.state}</Badge>
										</TableCell>
										<TableCell className='text-muted-foreground'>
											{new Date(issue.lastSeen).toLocaleString('pt-BR')}
										</TableCell>
										<TableCell className='text-right'>
											<Badge variant='secondary'>{issue.totalCount}</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					<Pagination
						page={page}
						totalPages={totalPages}
						basePath='/error-tracking'
						params={{ query, since }}
					/>
				</>
			)}
		</main>
	);
}
