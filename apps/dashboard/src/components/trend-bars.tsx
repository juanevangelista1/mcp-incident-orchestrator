// Mini gráfico de barras verticais em CSS puro (sem lib de gráfico — mesma decisão já tomada
// nesta sessão de não trazer Recharts). Cada barra tem `title` com o valor exato + rótulo,
// já que a altura sozinha não é precisa o bastante pra leitura fina.
export function TrendBars({
	points,
	valueLabel,
	color = 'bg-sky-500',
}: {
	points: { label: string; value: number }[];
	valueLabel: string;
	color?: string;
}) {
	const max = Math.max(1, ...points.map((p) => p.value));

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-end gap-1" style={{ height: '8rem' }}>
				{points.map((p, i) => (
					<div
						key={i}
						title={`${p.label}: ${p.value} ${valueLabel}`}
						className={`min-h-1 flex-1 rounded-t ${color}`}
						style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
					/>
				))}
			</div>
			<div className="flex gap-1">
				{points.map((p, i) => (
					<span key={i} className="text-muted-foreground flex-1 truncate text-center text-[10px]">
						{p.label}
					</span>
				))}
			</div>
		</div>
	);
}
