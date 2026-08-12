import { listDailyReports } from '@/db/client';
import { toDailyPoints, percentChange } from '@/lib/trends';
import { formatDateShortBR, rangeIncludesToday } from '@/lib/date-format';
import { TodayDelayWarning } from '@/components/today-delay-warning';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageTitle } from '@/components/page-title';
import { DailyTrendChart } from '@/components/charts/daily-trend-chart';
import { BookingSnapshot } from '@/components/booking-snapshot';
import { CalendarCheck, TrendingUp, TrendingDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

const BOOKING_URL_PATTERN = process.env.CLARITY_BOOKING_URL_PATTERN ?? '';

function ChangeBadge({ percent }: { percent: number | null }) {
	if (percent === null) return <Badge variant="outline">sem dado suficiente</Badge>;
	const up = percent >= 0;
	return (
		<Badge className={up ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-600/10 text-rose-600 dark:text-rose-400'}>
			{up ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
			{percent >= 0 ? '+' : ''}
			{percent.toFixed(1)}%
		</Badge>
	);
}

// Não existe evento de conversão real (GA4/CRM/formulário) conectado ao projeto. Este proxy
// usa sessões que chegaram numa URL configurável (rota da página de agendamento) como
// indicador de intenção — NUNCA como confirmação de que o agendamento foi de fato concluído.
//
// A tendência histórica abaixo vem do que o digest diário já persistiu em `daily_reports`
// (zero chamada nova ao Clarity, qualquer período que já tenha sido coletado). O "instantâneo
// ao vivo" continua existindo, mas agora é uma ação manual (ver BookingSnapshot) — antes esta
// página fazia 2 chamadas reais ao Clarity toda vez que era aberta, o que somado à navegação
// normal do dashboard já esgotou o limite de 10 requisições/dia da API mais de uma vez.
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
					trecho da URL da página de agendamento para habilitar esta análise.
				</p>
			</main>
		);
	}

	const points = toDailyPoints(listDailyReports());
	const last14 = points.slice(-14).map((p) => ({
		date: p.date,
		bookingArrivals: p.bookingArrivals,
		claritySessions: p.claritySessions,
		rate: p.bookingArrivals != null && p.claritySessions ? (p.bookingArrivals / p.claritySessions) * 100 : null,
	}));
	const daysWithBookingData = last14.filter((p) => p.bookingArrivals !== null).length;
	const lastDay = last14.at(-1);
	const prevDay = last14.at(-2);

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<PageTitle
				icon={CalendarCheck}
				accent="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
				title="Funil de agendamento (proxy)"
				subtitle={
					<p className="text-muted-foreground text-sm">
						Filtro de URL: <code>{BOOKING_URL_PATTERN}</code>
					</p>
				}
			/>

			<p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
				Não existe evento de conversão real (GA4/CRM/formulário) conectado ao projeto. Este número mede
				apenas <strong>sessões que chegaram</strong> na URL configurada acima: um proxy de intenção, não uma
				confirmação de agendamento concluído.
			</p>

			{lastDay && rangeIncludesToday(lastDay.date) && <TodayDelayWarning />}

			<Card className="border-t-4 border-t-sky-500/70">
				<CardHeader>
					<div className="flex items-center justify-between gap-2">
						<CardTitle>Tendência histórica (gratuita, sem consumir cota do Clarity)</CardTitle>
						{lastDay && <ChangeBadge percent={percentChange(lastDay.rate, prevDay?.rate ?? null)} />}
					</div>
					<CardDescription>
						Taxa diária de chegada em agendamento (chegadas ÷ sessões totais), a partir do que o digest já
						coletou. {daysWithBookingData} dia(s) com dado desde que o filtro foi configurado.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{daysWithBookingData > 0 ? (
						<DailyTrendChart
							points={last14.map((p) => ({ label: formatDateShortBR(p.date), value: p.rate ? Number(p.rate.toFixed(1)) : 0 }))}
							valueLabel="% de chegada"
							color="#10b981"
						/>
					) : (
						<p className="text-muted-foreground text-sm">
							Ainda não há dias de digest com esse filtro coletado. O histórico começa a partir de
							amanhã, quando o cron rodar de novo com <code>CLARITY_BOOKING_URL_PATTERN</code> já
							configurado.
						</p>
					)}
				</CardContent>
			</Card>

			<BookingSnapshot />
		</main>
	);
}
