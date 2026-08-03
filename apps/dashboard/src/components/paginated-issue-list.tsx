'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown } from 'lucide-react';
import type { SentryIssue } from '@/lib/mcp-types';

// Mesmo padrão de paginação+ordenação local de paginated-metric-list.tsx, mas pro formato de
// issue do Sentry (título + badge de ocorrências) — usado nos "top erros" do comparador de
// rotas, que antes mostrava só um top 5 fixo mesmo já tendo até 100 issues buscadas.
export function PaginatedIssueList({
	issues,
	pageSize = 5,
	emptyMessage = 'Nenhum erro encontrado para essa rota.',
}: {
	issues: SentryIssue[];
	pageSize?: number;
	emptyMessage?: string;
}) {
	const [page, setPage] = useState(1);
	const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

	if (issues.length === 0) {
		return <p className="text-muted-foreground text-xs">{emptyMessage}</p>;
	}

	const sorted = [...issues].sort((a, b) => (sortDir === 'desc' ? b.count - a.count : a.count - b.count));
	const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
	const clampedPage = Math.min(page, totalPages);
	const pageItems = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<span className="text-muted-foreground text-xs">{sorted.length} erro(s)</span>
				<button
					type="button"
					onClick={() => {
						setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
						setPage(1);
					}}
					className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
				>
					<ArrowUpDown className="size-3" />
					{sortDir === 'desc' ? 'Maior → menor' : 'Menor → maior'}
				</button>
			</div>

			<div className="flex flex-col gap-1">
				{pageItems.map((issue) => (
					<div key={issue.id} className="flex items-center justify-between gap-2 text-xs">
						<span className="truncate" title={issue.title}>
							{issue.title}
						</span>
						<Badge variant="secondary" className="shrink-0">
							{issue.count}
						</Badge>
					</div>
				))}
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-between gap-3 text-xs">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={clampedPage <= 1}
						className="focus-visible:ring-ring rounded-md border px-2 py-1 hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
						className="focus-visible:ring-ring rounded-md border px-2 py-1 hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						Próxima
					</button>
				</div>
			)}
		</div>
	);
}
