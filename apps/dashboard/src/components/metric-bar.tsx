// Linha de métrica com barra proporcional preenchida — o padrão visual do Clarity para listas
// como "Top Pages" (barra clara atrás do texto, comprimento proporcional ao valor máximo da
// lista), em vez de só um número solto num Badge.
export function MetricBar({
	label,
	value,
	max,
	barColor = 'bg-primary/15',
	title,
}: {
	label: string;
	value: number;
	max: number;
	barColor?: string;
	title?: string;
}) {
	const percent = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;

	return (
		<div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-md px-2 py-1.5 text-sm">
			<span aria-hidden="true" className={`absolute inset-y-0 left-0 ${barColor}`} style={{ width: `${percent}%` }} />
			<span title={title ?? label} className="relative z-10 truncate text-foreground/90">
				{label}
			</span>
			<span className="relative z-10 shrink-0 font-medium tabular-nums">{value}</span>
		</div>
	);
}
