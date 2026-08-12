import { listDailyReports, getNarrative } from '@/db/client';
import { toNarrativeProp } from '@/lib/narrative-prop';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageTitle } from '@/components/page-title';
import { DailyTrendChart } from '@/components/charts/daily-trend-chart';
import { toDailyPoints, percentChange, weeklyRollup, monthlyRollup, baseline } from '@/lib/trends';
import { formatDateShortBR, formatDateBR, rangeIncludesToday, defaultGa4Range, todayISO } from '@/lib/date-format';
import { formatNumberBR } from '@/lib/format';
import { TodayDelayWarning } from '@/components/today-delay-warning';
import { detectScenario } from '@/lib/scenarios';
import { ReportsNarrativeAndExport } from '@/components/reports-narrative-and-export';
import { ReportsHistory } from '@/components/reports-history';
import { RouteReportNarrativeAndExport } from '@/components/route-report-narrative-and-export';
import { PaginatedIssueList } from '@/components/paginated-issue-list';
import { BookingEventColumn } from '@/components/booking-event-column';
import { fetchRouteSnapshot } from '@/lib/route-snapshot';
import { FileText, TrendingUp, TrendingDown, Microscope, Search } from 'lucide-react';

// Acima disso, a taxa ocorrências÷sessões (heurística, ver route-snapshot.ts) fica destacada
// como aviso — abaixo, é tratada como normal. Não é um SLO oficial, só um corte visual pra
// chamar atenção sem precisar ler o número e fazer a conta de cabeça.
const ERROR_RATE_WARNING_THRESHOLD = 5;

// Lê o SQLite local a cada request — o histórico muda a cada digest novo, não deve
// ficar preso ao snapshot do momento do build.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ route?: string; from?: string; to?: string }>;

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

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
	const { route, from: fromParam, to: toParam } = await searchParams;
	const { from: defaultFrom, to: defaultTo } = defaultGa4Range();
	const from = fromParam || defaultFrom;
	const to = toParam || defaultTo;

	const reports = listDailyReports();
	const points = toDailyPoints(reports);
	const last14 = points.slice(-14);
	const weeks = weeklyRollup(points);
	const months = monthlyRollup(points);
	const sessionsBaseline = baseline(points, 'claritySessions');
	const occurrencesBaseline = baseline(points, 'sentryOccurrences');
	const bookingBaseline = baseline(points, 'bookingArrivals');
	const ga4ConversionsBaseline = baseline(points, 'ga4Conversions');

	const lastDay = points.at(-1);
	const prevDay = points.at(-2);
	const scenario = lastDay ? detectScenario(lastDay, prevDay) : null;
	const lastWeek = weeks.at(-1);
	const prevWeek = weeks.at(-2);
	const lastMonth = months.at(-1);
	const prevMonth = months.at(-2);

	// Taxa de conversão (proxy): chegadas em agendamento ÷ sessões totais do dia. `null`
	// quando falta um dos dois — não vira 0%, que enganaria como "conversão zero".
	const conversionRate = (p: { bookingArrivals: number | null; claritySessions: number | null }) =>
		p.bookingArrivals != null && p.claritySessions ? (p.bookingArrivals / p.claritySessions) * 100 : null;
	const lastDayRate = lastDay ? conversionRate(lastDay) : null;
	const prevDayRate = prevDay ? conversionRate(prevDay) : null;
	const daysWithBookingData = last14.filter((p) => p.bookingArrivals !== null).length;
	const daysWithGa4Data = last14.filter((p) => p.ga4Conversions !== null).length;

	// Relatório sob demanda de UMA rota (não o histórico do digest acima) — busca dado fresco
	// direto das 4 fontes pro período escolhido, ao contrário do resto da página, que só lê o
	// que o digest diário já persistiu.
	const routeSnapshot = route ? await fetchRouteSnapshot({ route, startDate: from, endDate: to }) : null;
	const routeBaseline = { ocorrenciasSentryMedia: occurrencesBaseline?.avg ?? null, conversoesGa4Media: ga4ConversionsBaseline?.avg ?? null };
	const routeBaselineNote = routeSnapshot
		? [
				occurrencesBaseline &&
					`Ocorrências Sentry desta rota (${formatNumberBR(routeSnapshot.totalOccurrences)}) vs. média global diária (${formatNumberBR(Math.round(occurrencesBaseline.avg))}): ${
						routeSnapshot.totalOccurrences > occurrencesBaseline.avg ? 'acima' : 'abaixo'
					} da média.`,
				ga4ConversionsBaseline &&
					routeSnapshot.ga4?.conversions != null &&
					`Conversões GA4 desta rota (${formatNumberBR(routeSnapshot.ga4.conversions)}) vs. média global diária (${formatNumberBR(Math.round(ga4ConversionsBaseline.avg))}): ${
						routeSnapshot.ga4.conversions > ga4ConversionsBaseline.avg ? 'acima' : 'abaixo'
					} da média.`,
			]
				.filter(Boolean)
				.join(' ')
		: undefined;

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={FileText}
					accent="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
					title="Relatórios diários"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Histórico gerado por <code>/api/cron/daily-digest</code>: Sentry, Datadog e Clarity.
						</p>
					}
				/>
				{reports.length > 0 && (
					<div className="flex shrink-0 gap-2">
						<a
							href="/api/export/reports"
							className="focus-visible:ring-ring self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
						>
							Baixar CSV
						</a>
					</div>
				)}
			</header>

			{lastDay && rangeIncludesToday(lastDay.date) && <TodayDelayWarning />}

			<Card className="border-t-4 border-t-sky-500/70">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Search className="text-sky-600 dark:text-sky-400 size-4" />
						Relatório por rota (sob demanda)
					</CardTitle>
					<CardDescription>
						Busca dado fresco (Sentry + Datadog + Clarity + GA4) para uma rota e período
						específicos, diferente do histórico abaixo, que só lê o que o digest diário já
						coletou.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form method="get" action="/reports" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
						<label className="flex flex-col gap-1 text-xs">
							<span className="text-muted-foreground">Rota</span>
							<input
								type="text"
								name="route"
								defaultValue={route}
								placeholder="agendamento-de-visita"
								className="focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs">
							<span className="text-muted-foreground">De</span>
							<input
								type="date"
								name="from"
								defaultValue={from}
								className="focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs">
							<span className="text-muted-foreground">Até</span>
							<input
								type="date"
								name="to"
								defaultValue={to}
								className="focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
							/>
						</label>
						<button
							type="submit"
							className="focus-visible:ring-ring self-end rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:outline-none"
						>
							Gerar relatório
						</button>
					</form>

					{!routeSnapshot && (
						<p className="text-muted-foreground text-sm">
							Digite uma rota acima (busca parcial, igual ao filtro de rota do Sentry, não
							precisa ser a URL inteira) para gerar um relatório sob demanda.
						</p>
					)}

					{routeSnapshot && (
						<div className="flex flex-col gap-4">
							<p className="text-muted-foreground text-xs">
								Período: {formatDateBR(from)} até {formatDateBR(to)}
							</p>
							{to < todayISO() && (
								<p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
									Sentry e GA4 respeitam esse período exato. Clarity (máx. 3 dias) e Datadog (máx.
									7 dias) não aceitam uma janela [de, até] no passado: mostram sempre a janela
									mais recente disponível terminando agora, então os números dessas duas fontes
									podem não corresponder ao período selecionado acima.
								</p>
							)}
							{rangeIncludesToday(to) && <TodayDelayWarning />}

							<div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
								<div>
									<p className="text-muted-foreground text-xs">Issues (Sentry)</p>
									<p className="text-xl font-semibold">{formatNumberBR(routeSnapshot.issues.length)}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Ocorrências (Sentry)</p>
									<p className="text-xl font-semibold">{formatNumberBR(routeSnapshot.totalOccurrences)}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Issues (Datadog)</p>
									<p className="text-xl font-semibold">{formatNumberBR(routeSnapshot.datadogIssues.length)}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Sessões (Clarity)</p>
									<p className="text-xl font-semibold">
										{routeSnapshot.clarity ? formatNumberBR(routeSnapshot.clarity.totalSessions) : '-'}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Sessões (GA4, real)</p>
									<p className="text-xl font-semibold">
										{routeSnapshot.ga4 ? formatNumberBR(routeSnapshot.ga4.sessions) : '-'}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Conversões (GA4, real)</p>
									<p className="text-xl font-semibold">
										{routeSnapshot.ga4?.conversions != null ? formatNumberBR(routeSnapshot.ga4.conversions) : '-'}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs" title="Ocorrências Sentry ÷ sessões GA4 desta rota. Heurística, não é uma taxa de erro oficial de nenhuma das duas fontes.">
										Taxa de erro (heurística)
									</p>
									<p
										className={
											routeSnapshot.errorRatePercent !== null && routeSnapshot.errorRatePercent >= ERROR_RATE_WARNING_THRESHOLD
												? 'text-xl font-semibold text-rose-600 dark:text-rose-400'
												: 'text-xl font-semibold'
										}
									>
										{routeSnapshot.errorRatePercent !== null ? `${routeSnapshot.errorRatePercent.toFixed(1)}%` : '-'}
									</p>
								</div>
							</div>

							{routeSnapshot.errorRatePercent !== null && routeSnapshot.errorRatePercent >= ERROR_RATE_WARNING_THRESHOLD && (
								<p className="rounded-md border border-dashed border-rose-500/40 p-2 text-xs text-rose-600 dark:text-rose-400">
									Taxa de erro alta pra essa rota ({routeSnapshot.errorRatePercent.toFixed(1)}% das sessões GA4 tiveram
									pelo menos uma ocorrência de erro registrada) — pode valer olhar as issues abaixo mesmo se o número
									absoluto de ocorrências parecer pequeno perto de outras rotas.
								</p>
							)}

							<div>
								<div className="mb-1 flex items-center justify-between gap-2">
									<h3 className="text-xs font-medium">Agendamentos de visita nesta rota</h3>
									{routeSnapshot.bookingEvents && (
										<span className="text-muted-foreground text-xs">
											{formatNumberBR(routeSnapshot.bookingEvents.total)} no total
										</span>
									)}
								</div>
								{routeSnapshot.bookingEventsRouteMismatch ? (
									<div className="flex flex-col gap-2 rounded-md border border-dashed border-amber-500/40 p-2">
										<p className="text-xs text-amber-600 dark:text-amber-400">
											Nenhum evento de agendamento tem a URL desta rota, mas o site inteiro teve{' '}
											{formatNumberBR(routeSnapshot.bookingEventsSiteWide?.total ?? 0)} no mesmo período. O fluxo de
											agendamento provavelmente não roda numa URL própria (ex: modal sobre a página do imóvel) —
											os números abaixo são do site inteiro, não só desta rota.
										</p>
										<div className="grid gap-6 sm:grid-cols-2">
											<BookingEventColumn title="Locação (site inteiro)" items={routeSnapshot.bookingEventsSiteWide?.locacao ?? []} />
											<BookingEventColumn title="Venda (site inteiro)" items={routeSnapshot.bookingEventsSiteWide?.venda ?? []} />
										</div>
									</div>
								) : routeSnapshot.bookingEvents && routeSnapshot.bookingEvents.total > 0 ? (
									<div className="grid gap-6 sm:grid-cols-2">
										<BookingEventColumn title="Locação" items={routeSnapshot.bookingEvents.locacao} />
										<BookingEventColumn title="Venda" items={routeSnapshot.bookingEvents.venda} />
									</div>
								) : (
									<p className="text-muted-foreground text-xs">Nenhum evento de agendamento no período.</p>
								)}
							</div>

							{routeBaselineNote && (
								<p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
									{routeBaselineNote}
								</p>
							)}

							{routeSnapshot.sentryError && (
								<p className="rounded-md border border-dashed border-rose-500/40 p-2 text-xs text-rose-600 dark:text-rose-400">
									Sentry: {routeSnapshot.sentryError}
								</p>
							)}
							{routeSnapshot.clarityError && (
								<p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
									Clarity: {routeSnapshot.clarityError} (a API só aceita 1–3 dias por chamada)
								</p>
							)}
							{routeSnapshot.ga4Error && (
								<p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
									GA4: {routeSnapshot.ga4Error}
								</p>
							)}
							{routeSnapshot.datadogError && (
								<p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
									Datadog: {routeSnapshot.datadogError}
								</p>
							)}

							<div>
								<h3 className="mb-1 text-xs font-medium">Erros desta rota (Sentry)</h3>
								<PaginatedIssueList issues={routeSnapshot.issues} />
							</div>

							<RouteReportNarrativeAndExport
								route={route!}
								from={from}
								to={to}
								snapshot={routeSnapshot}
								baseline={routeBaseline}
								baselineNote={routeBaselineNote}
								initialNarrative={toNarrativeProp(getNarrative('route_report', `${route}|${from}|${to}`))}
							/>
						</div>
					)}
				</CardContent>
			</Card>

			{reports.length > 0 && (
				<section className="flex flex-col gap-6">
					<p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
						O Clarity só permite consultar 1-3 dias por chamada e não tem endpoint de histórico,
						por isso essas comparações só existem a partir de quando o digest diário começou a
						rodar continuamente. Não é possível reconstituir dias anteriores a isso.
					</p>

					{scenario && (
						<Card className="border-t-4 border-t-violet-500/70">
							<CardHeader>
								<div className="flex items-center gap-2">
									<Microscope className="text-violet-600 dark:text-violet-400 size-4" />
									<CardTitle>
										Cenário {scenario.code}: {scenario.label}
									</CardTitle>
								</div>
								<CardDescription>
									Correlação agregada por dia (não por sessão individual) entre erros, tráfego e chegadas
									em agendamento. Descreve o que aconteceu, não afirma causa e efeito por si só.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								<p className="text-sm">{scenario.description}</p>
								{scenario.evidence.length > 0 && (
									<div className="flex flex-wrap gap-2">
										{scenario.evidence.map((e) => (
											<Badge key={e} variant="outline">
												{e}
											</Badge>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					)}

					<ReportsNarrativeAndExport
						points={points}
						weeks={weeks}
						months={months}
						sessionsBaseline={sessionsBaseline}
						occurrencesBaseline={occurrencesBaseline}
						bookingBaseline={bookingBaseline}
						ga4ConversionsBaseline={ga4ConversionsBaseline}
						scenario={scenario}
						initialNarrative={lastDay ? toNarrativeProp(getNarrative('period', lastDay.date)) : null}
					/>

					<Card className="border-t-4 border-t-emerald-500/70">
						<CardHeader>
							<div className="flex items-center justify-between gap-2">
								<CardTitle>Diário (últimos {last14.length} dia(s))</CardTitle>
								<ChangeBadge percent={percentChange(lastDay?.claritySessions ?? null, prevDay?.claritySessions ?? null)} />
							</div>
							<CardDescription>Sessões (Clarity) por dia, variação vs. dia anterior</CardDescription>
						</CardHeader>
						<CardContent>
							<DailyTrendChart
								points={last14.map((p) => ({ label: formatDateShortBR(p.date), value: p.claritySessions ?? 0 }))}
								valueLabel="sessão(ões)"
								color="#0ea5e9"
							/>
						</CardContent>
					</Card>

					<Card className="border-t-4 border-t-rose-500/70">
						<CardHeader>
							<div className="flex items-center justify-between gap-2">
								<CardTitle>Ocorrências de erro (Sentry) por dia</CardTitle>
								<ChangeBadge
									percent={percentChange(lastDay?.sentryOccurrences ?? null, prevDay?.sentryOccurrences ?? null)}
								/>
							</div>
							<CardDescription>Variação vs. dia anterior</CardDescription>
						</CardHeader>
						<CardContent>
							<DailyTrendChart
								points={last14.map((p) => ({ label: formatDateShortBR(p.date), value: p.sentryOccurrences ?? 0 }))}
								valueLabel="ocorrência(s)"
								color="#f43f5e"
							/>
						</CardContent>
					</Card>

					<Card className="border-t-4 border-t-emerald-500/70">
						<CardHeader>
							<div className="flex items-center justify-between gap-2">
								<CardTitle>Taxa de conversão (proxy) por dia</CardTitle>
								<ChangeBadge percent={percentChange(lastDayRate, prevDayRate)} />
							</div>
							<CardDescription>
								Chegadas em agendamento ÷ sessões totais, proxy de intenção, não confirmação de
								agendamento concluído. {daysWithBookingData} dia(s) com dado no período.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{daysWithBookingData > 0 ? (
								<DailyTrendChart
									points={last14.map((p) => {
										const rate = conversionRate(p);
										return { label: formatDateShortBR(p.date), value: rate ? Number(rate.toFixed(1)) : 0 };
									})}
									valueLabel="% de chegada"
									color="#10b981"
								/>
							) : (
								<p className="text-muted-foreground text-sm">
									Ainda não há dias com <code>CLARITY_BOOKING_URL_PATTERN</code> configurado no
									período. Histórico começa a partir de quando o cron rodar com o filtro ativo.
								</p>
							)}
						</CardContent>
					</Card>

					<Card className="border-t-4 border-t-teal-500/70">
						<CardHeader>
							<div className="flex items-center justify-between gap-2">
								<CardTitle>Conversões reais (GA4) por dia</CardTitle>
								<ChangeBadge percent={percentChange(lastDay?.ga4Conversions ?? null, prevDay?.ga4Conversions ?? null)} />
							</div>
							<CardDescription>
								Contagem do evento de conversão configurado no GA4 (não é proxy).{' '}
								{daysWithGa4Data} dia(s) com dado no período.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{daysWithGa4Data > 0 ? (
								<DailyTrendChart
									points={last14.map((p) => ({ label: formatDateShortBR(p.date), value: p.ga4Conversions ?? 0 }))}
									valueLabel="conversão(ões)"
									color="#14b8a6"
								/>
							) : (
								<p className="text-muted-foreground text-sm">
									Ainda não há dias com o plugin GA4 configurado (<code>GA4_PROPERTY_ID</code>/
									<code>GA4_CLIENT_EMAIL</code>/<code>GA4_PRIVATE_KEY</code>/
									<code>GA4_CONVERSION_EVENT_NAME</code>) no período.
								</p>
							)}
						</CardContent>
					</Card>

					<section className="grid gap-6 md:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Semanal</CardTitle>
								<CardDescription>Semana atual vs. anterior</CardDescription>
							</CardHeader>
							<CardContent>
								{weeks.length >= 2 ? (
									<div className="flex flex-col gap-2 text-sm">
										<div className="flex items-center gap-3">
											<span>
												{formatNumberBR(prevWeek!.claritySessions)} → {formatNumberBR(lastWeek!.claritySessions)} sessões
											</span>
											<ChangeBadge percent={percentChange(lastWeek!.claritySessions, prevWeek!.claritySessions)} />
										</div>
										<div className="flex items-center gap-3">
											<span>
												{formatNumberBR(prevWeek!.bookingArrivals)} → {formatNumberBR(lastWeek!.bookingArrivals)} agendamentos (proxy)
											</span>
											<ChangeBadge percent={percentChange(lastWeek!.bookingArrivals, prevWeek!.bookingArrivals)} />
										</div>
										<div className="flex items-center gap-3">
											<span>
												{formatNumberBR(prevWeek!.ga4Conversions)} → {formatNumberBR(lastWeek!.ga4Conversions)} conversões (GA4, real)
											</span>
											<ChangeBadge percent={percentChange(lastWeek!.ga4Conversions, prevWeek!.ga4Conversions)} />
										</div>
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										Ainda não há duas semanas completas de digest para comparar.
									</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Mensal</CardTitle>
								<CardDescription>Mês atual vs. anterior</CardDescription>
							</CardHeader>
							<CardContent>
								{months.length >= 2 ? (
									<div className="flex flex-col gap-2 text-sm">
										<div className="flex items-center gap-3">
											<span>
												{formatNumberBR(prevMonth!.claritySessions)} → {formatNumberBR(lastMonth!.claritySessions)} sessões
											</span>
											<ChangeBadge percent={percentChange(lastMonth!.claritySessions, prevMonth!.claritySessions)} />
										</div>
										<div className="flex items-center gap-3">
											<span>
												{formatNumberBR(prevMonth!.bookingArrivals)} → {formatNumberBR(lastMonth!.bookingArrivals)} agendamentos (proxy)
											</span>
											<ChangeBadge percent={percentChange(lastMonth!.bookingArrivals, prevMonth!.bookingArrivals)} />
										</div>
										<div className="flex items-center gap-3">
											<span>
												{formatNumberBR(prevMonth!.ga4Conversions)} → {formatNumberBR(lastMonth!.ga4Conversions)} conversões (GA4, real)
											</span>
											<ChangeBadge percent={percentChange(lastMonth!.ga4Conversions, prevMonth!.ga4Conversions)} />
										</div>
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										Ainda não há dois meses completos de digest para comparar.
									</p>
								)}
							</CardContent>
						</Card>
					</section>

					<Card>
						<CardHeader>
							<CardTitle>Baseline (comportamento normal)</CardTitle>
							<CardDescription>Média / maior / menor valor da janela disponível</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 text-sm sm:grid-cols-2">
								<div>
									<p className="text-muted-foreground mb-1 text-xs">Sessões (Clarity)</p>
									{sessionsBaseline ? (
										<p>
											média {formatNumberBR(Math.round(sessionsBaseline.avg))} · maior {formatNumberBR(sessionsBaseline.max)} · menor{' '}
											{formatNumberBR(sessionsBaseline.min)}
										</p>
									) : (
										<p className="text-muted-foreground">sem dado suficiente</p>
									)}
								</div>
								<div>
									<p className="text-muted-foreground mb-1 text-xs">Ocorrências de erro (Sentry)</p>
									{occurrencesBaseline ? (
										<p>
											média {formatNumberBR(Math.round(occurrencesBaseline.avg))} · maior {formatNumberBR(occurrencesBaseline.max)} · menor{' '}
											{formatNumberBR(occurrencesBaseline.min)}
										</p>
									) : (
										<p className="text-muted-foreground">sem dado suficiente</p>
									)}
								</div>
								<div>
									<p className="text-muted-foreground mb-1 text-xs">Chegadas em agendamento (proxy)</p>
									{bookingBaseline ? (
										<p>
											média {formatNumberBR(Math.round(bookingBaseline.avg))} · maior {formatNumberBR(bookingBaseline.max)} · menor{' '}
											{formatNumberBR(bookingBaseline.min)}
										</p>
									) : (
										<p className="text-muted-foreground">sem dado suficiente</p>
									)}
								</div>
								<div>
									<p className="text-muted-foreground mb-1 text-xs">Conversões (GA4, real)</p>
									{ga4ConversionsBaseline ? (
										<p>
											média {formatNumberBR(Math.round(ga4ConversionsBaseline.avg))} · maior {formatNumberBR(ga4ConversionsBaseline.max)} · menor{' '}
											{formatNumberBR(ga4ConversionsBaseline.min)}
										</p>
									) : (
										<p className="text-muted-foreground">sem dado suficiente</p>
									)}
								</div>
							</div>
						</CardContent>
					</Card>
				</section>
			)}

			{reports.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Nenhum digest gerado ainda. Chame <code>/api/cron/daily-digest</code> para criar o primeiro.
				</p>
			) : (
				<ReportsHistory reports={reports} />
			)}
		</main>
	);
}
