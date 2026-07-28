import { listDailyReports } from '@/db/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageTitle } from '@/components/page-title';
import { DailyTrendChart } from '@/components/charts/daily-trend-chart';
import { toDailyPoints, percentChange, weeklyRollup, monthlyRollup, baseline } from '@/lib/trends';
import { detectScenario } from '@/lib/scenarios';
import { FileText, TrendingUp, TrendingDown, Microscope } from 'lucide-react';

// Lê o SQLite local a cada request — o histórico muda a cada digest novo, não deve
// ficar preso ao snapshot do momento do build.
export const dynamic = 'force-dynamic';

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

export default async function ReportsPage() {
	const reports = listDailyReports();
	const points = toDailyPoints(reports);
	const last14 = points.slice(-14);
	const weeks = weeklyRollup(points);
	const months = monthlyRollup(points);
	const sessionsBaseline = baseline(points, 'claritySessions');
	const occurrencesBaseline = baseline(points, 'sentryOccurrences');

	const lastDay = points.at(-1);
	const prevDay = points.at(-2);
	const scenario = lastDay ? detectScenario(lastDay, prevDay) : null;
	const lastWeek = weeks.at(-1);
	const prevWeek = weeks.at(-2);
	const lastMonth = months.at(-1);
	const prevMonth = months.at(-2);

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={FileText}
					accent="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
					title="Relatórios diários"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Histórico gerado por <code>/api/cron/daily-digest</code> — Sentry, Datadog e Clarity.
						</p>
					}
				/>
				{reports.length > 0 && (
					<a
						href="/api/export/reports"
						className="focus-visible:ring-ring shrink-0 self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
					>
						Baixar CSV
					</a>
				)}
			</header>

			{reports.length > 0 && (
				<section className="flex flex-col gap-6">
					<p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
						O Clarity só permite consultar 1–3 dias por chamada e não tem endpoint de histórico —
						por isso essas comparações só existem a partir de quando o digest diário começou a
						rodar continuamente. Não é possível reconstituir dias anteriores a isso.
					</p>

					{scenario && (
						<Card className="border-t-4 border-t-violet-500/70">
							<CardHeader>
								<div className="flex items-center gap-2">
									<Microscope className="text-violet-600 dark:text-violet-400 size-4" />
									<CardTitle>
										Cenário {scenario.code} — {scenario.label}
									</CardTitle>
								</div>
								<CardDescription>
									Correlação agregada por dia (não por sessão individual) entre erros, tráfego e chegadas
									em agendamento — descreve o que aconteceu, não afirma causa e efeito por si só.
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
								points={last14.map((p) => ({ label: p.date.slice(5), value: p.claritySessions ?? 0 }))}
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
								points={last14.map((p) => ({ label: p.date.slice(5), value: p.sentryOccurrences ?? 0 }))}
								valueLabel="ocorrência(s)"
								color="#f43f5e"
							/>
						</CardContent>
					</Card>

					<section className="grid gap-6 md:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Semanal</CardTitle>
								<CardDescription>Semana atual vs. anterior (sessões)</CardDescription>
							</CardHeader>
							<CardContent>
								{weeks.length >= 2 ? (
									<div className="flex items-center gap-3 text-sm">
										<span>
											{prevWeek!.claritySessions} → {lastWeek!.claritySessions} sessões
										</span>
										<ChangeBadge percent={percentChange(lastWeek!.claritySessions, prevWeek!.claritySessions)} />
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
								<CardDescription>Mês atual vs. anterior (sessões)</CardDescription>
							</CardHeader>
							<CardContent>
								{months.length >= 2 ? (
									<div className="flex items-center gap-3 text-sm">
										<span>
											{prevMonth!.claritySessions} → {lastMonth!.claritySessions} sessões
										</span>
										<ChangeBadge percent={percentChange(lastMonth!.claritySessions, prevMonth!.claritySessions)} />
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
											média {sessionsBaseline.avg.toFixed(0)} · maior {sessionsBaseline.max} · menor{' '}
											{sessionsBaseline.min}
										</p>
									) : (
										<p className="text-muted-foreground">sem dado suficiente</p>
									)}
								</div>
								<div>
									<p className="text-muted-foreground mb-1 text-xs">Ocorrências de erro (Sentry)</p>
									{occurrencesBaseline ? (
										<p>
											média {occurrencesBaseline.avg.toFixed(0)} · maior {occurrencesBaseline.max} · menor{' '}
											{occurrencesBaseline.min}
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
				<div className="flex flex-col gap-4">
					{reports.map((report) => (
						<Card key={report.id}>
							<CardHeader>
								<CardTitle>{report.date}</CardTitle>
								<CardDescription>{report.summary}</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2 text-sm">
									<Badge className="bg-rose-600/10 text-rose-600 dark:text-rose-400">
										Sentry: {report.sentryCount}
									</Badge>
									<Badge className="bg-violet-600/10 text-violet-600 dark:text-violet-400">
										Datadog: {report.datadogCount ?? 'indisponível'}
									</Badge>
									<Badge className="bg-sky-600/10 text-sky-600 dark:text-sky-400">
										Clarity: {report.claritySessions ?? 'indisponível'}
									</Badge>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</main>
	);
}
