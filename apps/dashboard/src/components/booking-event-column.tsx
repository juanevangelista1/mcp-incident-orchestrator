import { formatNumberBR } from '@/lib/format';
import type { BookingEventItem } from '@/lib/ga4-booking-events';

// Compartilhado entre /ga4 (card "Agendamentos de visita") e /reports (relatório por rota) —
// mesma listagem item a item, evento por evento, em vez de um total somado que esconde a
// composição (ver lib/ga4-booking-events.ts para o agrupamento locação/venda/geral).
export function BookingEventColumn({ title, items }: { title: string; items: BookingEventItem[] }) {
	const subtotal = items.reduce((sum, i) => sum + i.count, 0);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-medium">{title}</h3>
				<span className="text-muted-foreground text-xs">{formatNumberBR(subtotal)}</span>
			</div>
			{items.length === 0 ? (
				<p className="text-muted-foreground text-xs">Nenhum evento no período.</p>
			) : (
				<ul className="flex flex-col gap-1.5">
					{items.map((item) => (
						<li key={item.eventName} className="flex items-center justify-between gap-2 text-sm">
							<span title={item.eventName} className="text-muted-foreground truncate">
								{item.label}
							</span>
							<span className="shrink-0 font-medium">{formatNumberBR(item.count)}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
