// Uma linha por execução do digest diário. `rawData` guarda o payload bruto das 4 fontes
// (Sentry/Datadog/Clarity/AWS) como JSON serializado — SQLite não tem tipo jsonb nativo,
// então serializamos/desserializamos na camada de aplicação (ver src/db/client.ts).
export const CREATE_DAILY_REPORTS_TABLE = `
CREATE TABLE IF NOT EXISTS daily_reports (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date TEXT NOT NULL,
	summary TEXT NOT NULL,
	sentry_count INTEGER NOT NULL,
	datadog_count INTEGER,
	clarity_sessions INTEGER,
	aws_count INTEGER,
	raw_data TEXT NOT NULL,
	created_at TEXT NOT NULL
)`;

export interface DailyReport {
	id: number;
	date: string;
	summary: string;
	sentryCount: number;
	datadogCount: number | null;
	claritySessions: number | null;
	awsCount: number | null;
	rawData: string;
	createdAt: string;
}

export interface NewDailyReport {
	date: string;
	summary: string;
	sentryCount: number;
	datadogCount: number | null;
	claritySessions: number | null;
	awsCount: number | null;
	rawData: string;
	createdAt: string;
}
