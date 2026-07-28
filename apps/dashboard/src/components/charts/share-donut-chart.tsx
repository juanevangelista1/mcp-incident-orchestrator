'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const PALETTE = ['#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6', '#10b981', '#64748b'];

// Gráfico de rosca para distribuições (sessões por dispositivo/navegador) — melhor pra
// "qual fatia domina" do que uma lista de barras horizontais quando são poucas categorias.
export function ShareDonutChart({ data }: { data: { name: string; value: number }[] }) {
	if (data.length === 0) {
		return <p className="text-muted-foreground text-sm">Sem dados suficientes.</p>;
	}

	return (
		<div style={{ width: '100%', height: '14rem' }}>
			<ResponsiveContainer width="100%" height="100%">
				<PieChart>
					<Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
						{data.map((entry, i) => (
							<Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
						))}
					</Pie>
					<Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
					<Legend wrapperStyle={{ fontSize: 12 }} />
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}
