'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonBarChart } from '@/components/charts/comparison-bar-chart';
import { Loader2, RefreshCw } from 'lucide-react';

interface SnapshotData {
	totalSessions: number;
	bookingSessions: number;
	rate: number | null;
	deviceData: Record<string, string | number>[];
	browserData: Record<string, string | number>[];
}

// Instantâneo AO VIVO do funil — só dispara as 2 chamadas reais ao Clarity quando o usuário
// clica, nunca sozinho ao carregar a página (isso já causou "Rate limit do Clarity excedido"
// antes: navegar pelo dashboard ao longo do dia soma chamadas escondidas rápido demais).
export function BookingSnapshot() {
	const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
	const [data, setData] = useState<SnapshotData | null>(null);
	const [error, setError] = useState('');

	async function fetchSnapshot() {
		setState('loading');
		setError('');
		try {
			const res = await fetch('/api/insights/booking-snapshot', { method: 'POST' });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? 'Falha ao consultar o Clarity.');
			setData(json);
			setState('done');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Falha ao consultar o Clarity.');
			setState('error');
		}
	}

	return (
		<Card className="border-t-4 border-t-emerald-500/70">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Instantâneo ao vivo</CardTitle>
					<button
						type="button"
						onClick={fetchSnapshot}
						disabled={state === 'loading'}
						className="focus-visible:ring-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
					>
						{state === 'loading' ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
						{state === 'loading' ? 'Consultando...' : 'Atualizar agora'}
					</button>
				</div>
				<CardDescription>
					Consulta 2 chamadas reais ao Clarity (limite: 10/dia) — por isso não é automático. Use com
					moderação; a tendência histórica abaixo é gratuita e não consome cota.
				</CardDescription>
			</CardHeader>
			{state === 'error' && (
				<CardContent>
					<p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
				</CardContent>
			)}
			{state === 'done' && data && (
				<CardContent className="flex flex-col gap-6">
					<section className="grid grid-cols-3 gap-4">
						<div>
							<p className="text-muted-foreground text-xs">Sessões totais</p>
							<p className="text-2xl font-semibold">{data.totalSessions}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Chegaram no agendamento</p>
							<p className="text-2xl font-semibold">{data.bookingSessions}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Taxa de chegada (proxy)</p>
							<p className="text-2xl font-semibold">{data.rate !== null ? `${data.rate.toFixed(1)}%` : '—'}</p>
						</div>
					</section>

					<div>
						<h3 className="mb-2 text-sm font-medium">Por dispositivo</h3>
						<ComparisonBarChart
							data={data.deviceData}
							series={[
								{ key: 'total', label: 'Total do site', color: '#0ea5e9' },
								{ key: 'booking', label: 'Chegou no agendamento', color: '#10b981' },
							]}
						/>
					</div>

					<div>
						<h3 className="mb-2 text-sm font-medium">Por navegador</h3>
						<ComparisonBarChart
							data={data.browserData}
							series={[
								{ key: 'total', label: 'Total do site', color: '#0ea5e9' },
								{ key: 'booking', label: 'Chegou no agendamento', color: '#10b981' },
							]}
						/>
					</div>
				</CardContent>
			)}
		</Card>
	);
}
