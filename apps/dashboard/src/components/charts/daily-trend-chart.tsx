'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Recharts precisa rodar no cliente (usa medição de layout via ResizeObserver).
// Substitui o antigo componente TrendBars (CSS puro) por um gráfico de área de verdade,
// com tooltip exato por ponto e eixos legíveis.
export function DailyTrendChart({
	points,
	valueLabel,
	color = '#0ea5e9',
}: {
	points: { label: string; value: number }[];
	valueLabel: string;
	color?: string;
}) {
	if (points.length === 0) {
		return <p className="text-muted-foreground text-sm">Sem dados suficientes para o gráfico.</p>;
	}

	const gradientId = `trend-${valueLabel.replace(/\s+/g, '-')}`;

	return (
		<div style={{ width: '100%', height: '12rem' }}>
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stopColor={color} stopOpacity={0.35} />
							<stop offset="95%" stopColor={color} stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
					<XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
					<YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
					<Tooltip
						formatter={(value) => [`${value} ${valueLabel}`, '']}
						labelFormatter={(label) => label}
						contentStyle={{ fontSize: 12, borderRadius: 8 }}
					/>
					<Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
