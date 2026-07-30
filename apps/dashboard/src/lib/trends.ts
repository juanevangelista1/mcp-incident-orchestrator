import { DailyReport } from '@/db/schema';

// Uma linha normalizada por dia de digest, extraída de `daily_reports` (colunas planas +
// `raw_data` parseado). Campos ficam `null` quando a fonte estava indisponível naquele dia
// (plugin desligado, erro pontual) — nunca viram 0 silenciosamente, pra não distorcer médias.
export interface DailyPoint {
	date: string;
	sentryIssues: number;
	sentryOccurrences: number | null;
	claritySessions: number | null;
	clarityRageClicks: number | null;
	clarityDeadClicks: number | null;
	clarityScriptErrors: number | null;
	// Sessões que chegaram na URL de agendamento (proxy de intenção, não confirmação de
	// conversão) — só existe a partir do dia em que CLARITY_BOOKING_URL_PATTERN foi configurado.
	bookingArrivals: number | null;
	// GA4: conversão REAL de um evento específico (ver GA4_CONVERSION_EVENT_NAME no
	// mcp-server) — diferente de bookingArrivals, que é só um proxy de intenção do Clarity.
	ga4Sessions: number | null;
	ga4Conversions: number | null;
}

export function toDailyPoints(reports: DailyReport[]): DailyPoint[] {
	return reports
		.map((r) => {
			let raw: any = {};
			try {
				raw = JSON.parse(r.rawData);
			} catch {
				// raw_data corrompido/vazio nesse dia — segue só com as colunas planas.
			}
			return {
				date: r.date,
				sentryIssues: r.sentryCount,
				sentryOccurrences: raw?.sentry?.totalOccurrences ?? null,
				claritySessions: r.claritySessions,
				clarityRageClicks: raw?.clarity?.rageClicks ?? null,
				clarityDeadClicks: raw?.clarity?.deadClicks ?? null,
				clarityScriptErrors: raw?.clarity?.scriptErrors ?? null,
				bookingArrivals: raw?.clarityBooking?.totalSessions ?? null,
				ga4Sessions: raw?.ga4?.sessions ?? null,
				ga4Conversions: raw?.ga4?.conversions ?? null,
			};
		})
		.sort((a, b) => a.date.localeCompare(b.date));
}

// Fórmula pedida explicitamente: ((atual - anterior) / anterior) × 100. `null` quando não dá
// pra calcular de forma honesta (falta um dos dois valores, ou anterior é 0 — divisão por
// zero não vira "infinito", vira "não calculável").
export function percentChange(current: number | null, previous: number | null): number | null {
	if (current == null || previous == null || previous === 0) return null;
	return ((current - previous) / previous) * 100;
}

function mondayOf(dateStr: string): string {
	const d = new Date(`${dateStr}T00:00:00Z`);
	const day = d.getUTCDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setUTCDate(d.getUTCDate() + diff);
	return d.toISOString().slice(0, 10);
}

function monthOf(dateStr: string): string {
	return dateStr.slice(0, 7);
}

export interface RollupRow {
	key: string;
	sentryOccurrences: number;
	claritySessions: number;
	clarityScriptErrors: number;
	// Soma de chegadas em agendamento na janela (semana/mês) — faltava antes, então o
	// semanal/mensal não respondiam "quantos leads/agendamentos" nem "taxa de conversão",
	// só o diário respondia.
	bookingArrivals: number;
	ga4Sessions: number;
	ga4Conversions: number;
}

function rollup(points: DailyPoint[], keyFn: (p: DailyPoint) => string): RollupRow[] {
	const map = new Map<string, RollupRow>();
	for (const p of points) {
		const key = keyFn(p);
		const row =
			map.get(key) ??
			({
				key,
				sentryOccurrences: 0,
				claritySessions: 0,
				clarityScriptErrors: 0,
				bookingArrivals: 0,
				ga4Sessions: 0,
				ga4Conversions: 0,
			} as RollupRow);
		row.sentryOccurrences += p.sentryOccurrences ?? 0;
		row.claritySessions += p.claritySessions ?? 0;
		row.clarityScriptErrors += p.clarityScriptErrors ?? 0;
		row.bookingArrivals += p.bookingArrivals ?? 0;
		row.ga4Sessions += p.ga4Sessions ?? 0;
		row.ga4Conversions += p.ga4Conversions ?? 0;
		map.set(key, row);
	}
	return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function weeklyRollup(points: DailyPoint[]): RollupRow[] {
	return rollup(points, (p) => mondayOf(p.date));
}

export function monthlyRollup(points: DailyPoint[]): RollupRow[] {
	return rollup(points, (p) => monthOf(p.date));
}

export interface Baseline {
	avg: number;
	max: number;
	min: number;
}

// Média/maior/menor valor da janela disponível — o "comportamento normal" contra o qual dá pra
// comparar um dia específico. Deliberadamente neutro (não "melhor"/"pior"): pra sessões, maior
// costuma ser bom; pra ocorrências de erro, maior é ruim — quem lê decide o que significa.
// Só considera dias com dado real (não conta null como 0).
export function baseline(points: DailyPoint[], field: keyof DailyPoint): Baseline | null {
	const values = points.map((p) => p[field]).filter((v): v is number => typeof v === 'number');
	if (values.length === 0) return null;
	return {
		avg: values.reduce((a, b) => a + b, 0) / values.length,
		max: Math.max(...values),
		min: Math.min(...values),
	};
}
