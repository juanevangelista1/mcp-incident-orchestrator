import { listDailyReports } from '@/db/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Lê o SQLite local a cada request — o histórico muda a cada digest novo, não deve
// ficar preso ao snapshot do momento do build.
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
	const reports = listDailyReports();

	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
			<header>
				<h1 className="text-2xl font-semibold">Relatórios diários</h1>
				<p className="text-muted-foreground text-sm">
					Histórico gerado por <code>/api/cron/daily-digest</code> — Sentry, Datadog, Clarity e AWS.
				</p>
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
									<Badge variant="secondary">Sentry: {report.sentryCount}</Badge>
									<Badge variant="secondary">
										Datadog: {report.datadogCount ?? 'indisponível'}
									</Badge>
									<Badge variant="secondary">AWS: {report.awsCount ?? 'indisponível'}</Badge>
									<Badge variant="secondary">
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
