'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown } from 'lucide-react';
import type { DailyReport } from '@/db/schema';

const PAGE_SIZE = 5;

// Antes esta lista mostrava TODO o histórico de digests de uma vez, sem limite — cresce um
// registro por dia, então isso ia virar uma rolagem infinita mais cedo ou mais tarde.
// Paginação+ordenação local (mesmo padrão de paginated-metric-list.tsx): os dados já vêm
// inteiros de `listDailyReports()`, só o corte em página que muda.
export function ReportsHistory({ reports }: { reports: DailyReport[] }) {
	const [page, setPage] = useState(1);
	const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

	// `reports` já vem ORDER BY date DESC do banco — só inverte quando o usuário pede.
	const sorted = sortDir === 'desc' ? reports : [...reports].reverse();
	const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
	const clampedPage = Math.min(page, totalPages);
	const pageItems = sorted.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-2">
				<span className="text-muted-foreground text-xs">{sorted.length} digest(s)</span>
				<button
					type="button"
					onClick={() => {
						setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
						setPage(1);
					}}
					className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
				>
					<ArrowUpDown className="size-3" />
					{sortDir === 'desc' ? 'Mais recente primeiro' : 'Mais antigo primeiro'}
				</button>
			</div>

			<div className="flex flex-col gap-4">
				{pageItems.map((report) => (
					<Card key={report.id}>
						<CardHeader>
							<CardTitle>{report.date}</CardTitle>
							<CardDescription>{report.summary}</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex flex-wrap gap-2 text-sm">
								<Badge className="bg-rose-600/10 text-rose-600 dark:text-rose-400">Sentry: {report.sentryCount}</Badge>
								<Badge className="bg-violet-600/10 text-violet-600 dark:text-violet-400">
									Datadog: {report.datadogCount ?? 'indisponível'}
								</Badge>
								<Badge className="bg-sky-600/10 text-sky-600 dark:text-sky-400">
									Clarity: {report.claritySessions ?? 'indisponível'}
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-between gap-3 text-sm">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={clampedPage <= 1}
						className="focus-visible:ring-ring rounded-md border px-3 py-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						Anterior
					</button>
					<span className="text-muted-foreground">
						Página {clampedPage} de {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={clampedPage >= totalPages}
						className="focus-visible:ring-ring rounded-md border px-3 py-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						Próxima
					</button>
				</div>
			)}
		</div>
	);
}
