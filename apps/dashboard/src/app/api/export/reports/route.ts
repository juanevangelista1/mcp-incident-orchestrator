import { listDailyReports } from '@/db/client';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET() {
	const reports = listDailyReports();
	const csv = toCsv(reports, [
		'date',
		'summary',
		'sentryCount',
		'datadogCount',
		'claritySessions',
		'awsCount',
		'createdAt',
	]);
	return csvResponse(csv, `daily-reports-${new Date().toISOString().slice(0, 10)}.csv`);
}
