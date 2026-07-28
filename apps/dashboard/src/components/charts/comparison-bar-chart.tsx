'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Barras agrupadas lado a lado — usado no funil de agendamento pra comparar "sessões totais"
// vs "sessões que chegaram na página de agendamento" por recorte (dispositivo/navegador).
export function ComparisonBarChart({
	data,
	series,
}: {
	data: Record<string, string | number>[];
	series: { key: string; label: string; color: string }[];
}) {
	if (data.length === 0) {
		return <p className="text-muted-foreground text-sm">Sem dados suficientes.</p>;
	}

	return (
		<div style={{ width: '100%', height: '16rem' }}>
			<ResponsiveContainer width="100%" height="100%">
				<BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
					<XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
					<YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
					<Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
					<Legend wrapperStyle={{ fontSize: 12 }} />
					{series.map((s) => (
						<Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
					))}
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
