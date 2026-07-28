import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights } from '@/lib/mcp-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { ComparisonBarChart } from '@/components/charts/comparison-bar-chart';
import { CalendarCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const BOOKING_URL_PATTERN = process.env.CLARITY_BOOKING_URL_PATTERN ?? '';

// Não existe nenhuma fonte real de "agendamento/conversão" conectada ao projeto (confirmado
// com o usuário). Este proxy usa sessões que chegaram numa URL configurável (rota da página
// de agendamento) como indicador de intenção — NUNCA como confirmação de que o agendamento
// foi de fato concluído (não temos evento de "enviou o formulário", só de "chegou na página").
function rate(part: number, total: number): number | null {
	if (total === 0) return null;
	return (part / total) * 100;
}

export default async function AgendamentoFunnelPage() {
	if (!BOOKING_URL_PATTERN) {
		return (
			<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
				<PageTitle
					icon={CalendarCheck}
					accent="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
					title="Funil de agendamento (proxy)"
				/>
				<p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
					Configure <code>CLARITY_BOOKING_URL_PATTERN</code> no <code>.env.local</code> do dashboard com um
					trecho da URL da página de agendamento (ex: <code>agendamento</code>) para habilitar esta análise.
				</p>
			</main>
		);
	}

	let total: ClarityInsights | undefined;
	let booking: ClarityInsights | undefined;
	let errorMessage: string | undefined;
	try {
		const [totalResult, bookingResult] = await Promise.all([
			callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3 }),
			callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3, url: BOOKING_URL_PATTERN }),
		]);
		total = totalResult.data;
		booking = bookingResult.data;
	} catch (error) {
		errorMessage = error instanceof Error ? error.message : String(error);
	}

	const overallRate = total && booking ? rate(booking.totalSessions, total.totalSessions) : null;

	const deviceData =
		total && booking
			? mergeByKey(total.sessionsByDevice, booking.sessionsByDevice, 'device')
			: [];
	const browserData =
		total && booking
			? mergeByKey(total.sessionsByBrowser, booking.sessionsByBrowser, 'browser')
			: [];

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<PageTitle
				icon={CalendarCheck}
				accent="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
				title="Funil de agendamento (proxy)"
				subtitle={
					<p className="text-muted-foreground text-sm">
						Filtro de URL: <code>{BOOKING_URL_PATTERN}</code> — últimos 3 dias
					</p>
				}
			/>

			<p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
				Não existe evento de conversão real (GA4/CRM/formulário) conectado ao projeto. Este número mede
				apenas <strong>sessões que chegaram</strong> na URL configurada acima — um proxy de intenção, não uma
				confirmação de agendamento concluído.
			</p>

			{!total || !booking ? (
				<p className="text-muted-foreground text-sm">
					{errorMessage ?? 'Clarity não configurado no MCP server.'}
				</p>
			) : (
				<>
					<section className="grid grid-cols-2 gap-4 md:grid-cols-3">
						<Card size="sm" className="border-t-4 border-t-sky-500/70">
							<CardHeader>
								<CardDescription>Sessões totais (site)</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{total.totalSessions}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-emerald-500/70">
							<CardHeader>
								<CardDescription>Chegaram no agendamento</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">{booking.totalSessions}</CardTitle>
							</CardHeader>
						</Card>
						<Card size="sm" className="border-t-4 border-t-violet-500/70">
							<CardHeader>
								<CardDescription>Taxa de chegada (proxy)</CardDescription>
								<CardTitle className="text-2xl sm:text-3xl">
									{overallRate !== null ? `${overallRate.toFixed(1)}%` : '—'}
								</CardTitle>
							</CardHeader>
						</Card>
					</section>

					<Card>
						<CardHeader>
							<CardTitle>Por dispositivo</CardTitle>
							<CardDescription>Sessões totais vs. chegadas no agendamento</CardDescription>
						</CardHeader>
						<CardContent>
							<ComparisonBarChart
								data={deviceData}
								series={[
									{ key: 'total', label: 'Total do site', color: '#0ea5e9' },
									{ key: 'booking', label: 'Chegou no agendamento', color: '#10b981' },
								]}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Por navegador</CardTitle>
							<CardDescription>Sessões totais vs. chegadas no agendamento</CardDescription>
						</CardHeader>
						<CardContent>
							<ComparisonBarChart
								data={browserData}
								series={[
									{ key: 'total', label: 'Total do site', color: '#0ea5e9' },
									{ key: 'booking', label: 'Chegou no agendamento', color: '#10b981' },
								]}
							/>
						</CardContent>
					</Card>
				</>
			)}
		</main>
	);
}

// Junta as duas listas (total e filtrada por agendamento) pela mesma chave (device/browser)
// num único array de pontos pro gráfico de barras agrupadas — só inclui recortes presentes no
// total (a lista "booking" tende a ser um subconjunto menor).
function mergeByKey(
	totalRows: { count: number; [key: string]: string | number }[],
	bookingRows: { count: number; [key: string]: string | number }[],
	labelField: string,
): Record<string, string | number>[] {
	const bookingByLabel = new Map(bookingRows.map((r) => [String(r[labelField]), r.count]));
	return totalRows.map((r) => ({
		label: String(r[labelField]),
		total: r.count,
		booking: bookingByLabel.get(String(r[labelField])) ?? 0,
	}));
}
