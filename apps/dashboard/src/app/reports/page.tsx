import { listDailyReports } from '@/db/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageTitle } from '@/components/page-title';
import { FileText } from 'lucide-react';

// Lê o SQLite local a cada request — o histórico muda a cada digest novo, não deve
// ficar preso ao snapshot do momento do build.
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
	const reports = listDailyReports();

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={FileText}
					accent="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
					title="Relatórios diários"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Histórico gerado por <code>/api/cron/daily-digest</code> — Sentry, Datadog, Clarity e AWS.
						</p>
					}
				/>
				{reports.length > 0 && (
					<a
						href="/api/export/reports"
						className="shrink-0 self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
					>
						Baixar CSV
					</a>
				)}
			</header>

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
									<Badge className="bg-amber-600/10 text-amber-600 dark:text-amber-400">
										AWS: {report.awsCount ?? 'indisponível'}
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
