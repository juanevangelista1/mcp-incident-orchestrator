import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CREATE_DAILY_REPORTS_TABLE, CREATE_DAILY_REPORTS_DATE_INDEX, DailyReport, NewDailyReport } from './schema';

// node:sqlite (Node 22.5+, requer o flag --experimental-sqlite — ver scripts em package.json)
// no lugar de better-sqlite3: evita depender de um binário nativo pré-compilado, que travou
// (access violation) nesta máquina mesmo fora do projeto/monorepo. Sem ORM porque é uma
// tabela só — SQL direto é mais simples de auditar do que introduzir Drizzle para isso.
const DB_PATH = process.env.SQLITE_PATH ?? './data/app.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(CREATE_DAILY_REPORTS_TABLE);
// Limpa duplicatas de dias que já existiam antes do índice único abaixo (mantém a execução
// mais recente de cada dia) — sem isso, CREATE UNIQUE INDEX falharia num banco com histórico.
db.exec(`
	DELETE FROM daily_reports
	WHERE id NOT IN (SELECT MAX(id) FROM daily_reports GROUP BY date)`);
db.exec(CREATE_DAILY_REPORTS_DATE_INDEX);

function toDailyReport(row: Record<string, unknown>): DailyReport {
	return {
		id: row.id as number,
		date: row.date as string,
		summary: row.summary as string,
		sentryCount: row.sentry_count as number,
		datadogCount: (row.datadog_count as number) ?? null,
		claritySessions: (row.clarity_sessions as number) ?? null,
		awsCount: (row.aws_count as number) ?? null,
		rawData: row.raw_data as string,
		createdAt: row.created_at as string,
	};
}

// Upsert por `date`: reexecutar o digest no mesmo dia atualiza a linha existente em vez de
// criar uma duplicata (ver índice único em schema.ts).
export function insertDailyReport(report: NewDailyReport): void {
	db.prepare(
		`INSERT INTO daily_reports
			(date, summary, sentry_count, datadog_count, clarity_sessions, aws_count, raw_data, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(date) DO UPDATE SET
			summary = excluded.summary,
			sentry_count = excluded.sentry_count,
			datadog_count = excluded.datadog_count,
			clarity_sessions = excluded.clarity_sessions,
			aws_count = excluded.aws_count,
			raw_data = excluded.raw_data,
			created_at = excluded.created_at`,
	).run(
		report.date,
		report.summary,
		report.sentryCount,
		report.datadogCount,
		report.claritySessions,
		report.awsCount,
		report.rawData,
		report.createdAt,
	);
}

export function listDailyReports(): DailyReport[] {
	const rows = db.prepare('SELECT * FROM daily_reports ORDER BY date DESC').all() as Record<string, unknown>[];
	return rows.map(toDailyReport);
}
