'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MetricBar } from '@/components/metric-bar';
import { ArrowUpDown } from 'lucide-react';

export interface MetricListItem {
	label: string;
	value: number;
	href?: string;
}

// Paginação + ordenação 100% local (sem query param, sem round-trip ao servidor) — os dados
// já vêm inteiros da página que renderiza isto (a lista completa já foi buscada, só o corte
// em N itens por vez que muda). Reaproveitado por todas as listas "top N" do dashboard
// (Clarity e GA4 em /insights) — antes cada uma mostrava só um top 5 fixo, sem forma de ver o
// resto nem de inverter a ordem.
export function PaginatedMetricList({
	items,
	pageSize = 5,
	barColor,
	emptyMessage = 'Nenhum item encontrado.',
}: {
	items: MetricListItem[];
	pageSize?: number;
	barColor?: string;
	emptyMessage?: string;
}) {
	const [page, setPage] = useState(1);
	const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

	if (items.length === 0) {
		return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
	}

	const sorted = [...items].sort((a, b) => (sortDir === 'desc' ? b.value - a.value : a.value - b.value));
	const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
	const clampedPage = Math.min(page, totalPages);
	const pageItems = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
	const max = sorted[0]?.value ?? 0;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<span className="text-muted-foreground text-xs">{sorted.length} item(ns)</span>
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
				{pageItems.map((item, i) =>
					item.href ? (
						// prefetch off: cada item vira uma rota dinâmica diferente (query string única),
						// e uma lista pode ter até 25 itens — sem isso, o Next buscaria dado ao vivo de
						// até 25 páginas só por elas terem entrado na viewport (ver prefetching.md,
						// "Preventing too many prefetches").
						<Link
							key={`${item.label}-${i}`}
							href={item.href}
							prefetch={false}
							className="block rounded-md hover:bg-accent/60"
						>
							<MetricBar label={item.label} value={item.value} max={max} barColor={barColor} />
						</Link>
					) : (
						<MetricBar key={`${item.label}-${i}`} label={item.label} value={item.value} max={max} barColor={barColor} />
					),
				)}
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
