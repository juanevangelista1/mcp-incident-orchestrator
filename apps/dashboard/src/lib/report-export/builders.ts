import type { ReportDocument } from './types';
import type { ClarityInsights, SentryIssue } from '@/lib/mcp-types';
import type { RankedIssue, PageRankRow } from '@/lib/error-severity';
import type { DailyPoint, RollupRow, Baseline } from '@/lib/trends';
import type { Scenario } from '@/lib/scenarios';

// Funções puras (sem DOM, sem fetch): recebem o que a página JÁ buscou pra se renderizar e
// devolvem um ReportDocument neutro. Ficam separadas dos componentes cliente pra serem fáceis
// de testar/reaproveitar, e pra `report-export-button.tsx` nunca precisar saber a origem dos
// dados de cada página.

export function buildInsightsReport(params: {
	data: ClarityInsights;
	numOfDays: number;
	urlFilter?: string;
	deviceFilter?: string;
}): ReportDocument {
	const { data, numOfDays, urlFilter, deviceFilter } = params;
	const filters = [urlFilter && `URL: ${urlFilter}`, deviceFilter && `Dispositivo: ${deviceFilter}`]
		.filter(Boolean)
		.join(' · ');

	return {
		title: 'Insights — Microsoft Clarity',
		subtitle: `Últimos ${numOfDays} dia(s)${filters ? ` — ${filters}` : ''}`,
		generatedAt: new Date(),
		sections: [
			{
				kind: 'kpi',
				heading: 'Resumo',
				items: [
					{ label: 'Sessões', value: data.totalSessions },
					{ label: 'Cliques contínuos (rage)', value: `${data.rageClickPercent}% (${data.rageClicks} sessão(ões))` },
					{ label: 'Cliques mortos (dead)', value: `${data.deadClickPercent}% (${data.deadClicks} sessão(ões))` },
					{ label: 'Erros de script', value: `${data.scriptErrorPercent}% (${data.scriptErrors} sessão(ões))` },
					{
						label: 'Rolagem excessiva',
						value: `${data.excessiveScrollPercent}% (${data.excessiveScrollSessions} sessão(ões))`,
					},
					{ label: 'Retornos rápidos', value: `${data.quickBackPercent}% (${data.quickBackSessions} sessão(ões))` },
					{ label: 'Baixo engajamento (estimativa, não oficial)', value: data.lowEngagementSessions },
				],
			},
			{
				kind: 'table',
				heading: 'Páginas mais visitadas',
				headers: ['URL', 'Sessões'],
				rows: data.topPages.map((p) => [p.url, p.sessions]),
			},
			{
				kind: 'table',
				heading: 'Rage clicks por página',
				headers: ['URL', 'Rage clicks'],
				rows: data.rageClicksByPage.map((p) => [p.url, p.count]),
			},
			{
				kind: 'table',
				heading: 'Dead clicks por página',
				headers: ['URL', 'Dead clicks'],
				rows: data.deadClicksByPage.map((p) => [p.url, p.count]),
			},
			{
				kind: 'table',
				heading: 'Erros de script por página',
				headers: ['URL', 'Erros de script'],
				rows: data.scriptErrorsByPage.map((p) => [p.url, p.count]),
			},
			{
				kind: 'table',
				heading: 'Sessões por dispositivo',
				headers: ['Dispositivo', 'Sessões'],
				rows: data.sessionsByDevice.map((d) => [d.device, d.count]),
			},
			{
				kind: 'table',
				heading: 'Sessões por navegador',
				headers: ['Navegador', 'Sessões'],
				rows: data.sessionsByBrowser.map((b) => [b.browser, b.count]),
			},
		],
	};
}

export function buildIssuesReport(params: {
	issues: SentryIssue[];
	rankedIssues: RankedIssue[];
	pageRank: PageRankRow[];
	clarityScriptErrors: { url: string; count: number }[];
	filters: Record<string, string | undefined>;
}): ReportDocument {
	const { issues, rankedIssues, pageRank, clarityScriptErrors, filters } = params;
	const activeFilters = Object.entries(filters)
		.filter(([, v]) => v)
		.map(([k, v]) => `${k}: ${v}`)
		.join(' · ');

	return {
		title: 'Issues — Sentry',
		subtitle: activeFilters || 'Sem filtros aplicados',
		generatedAt: new Date(),
		sections: [
			{
				kind: 'kpi',
				heading: 'Resumo',
				items: [
					{ label: 'Total de issues', value: issues.length },
					{ label: 'Ocorrências totais', value: issues.reduce((sum, i) => sum + i.count, 0) },
				],
			},
			{
				kind: 'table',
				heading: 'Issues',
				description: 'Severidade é heurística por percentil dentro deste conjunto filtrado, não um campo oficial do Sentry.',
				headers: ['Título', 'Rota/Culprit', 'Severidade', 'Ocorrências'],
				rows: rankedIssues.map((i) => [i.title, i.culprit, i.severity, i.count]),
			},
			{
				kind: 'table',
				heading: 'Ranking por página — Sentry',
				headers: ['Página/Culprit', 'Ocorrências'],
				rows: pageRank.map((r) => [r.page, r.sentryOccurrences]),
			},
			{
				kind: 'table',
				heading: 'Ranking por página — Clarity (erros de script)',
				description: 'Fonte e metodologia diferentes do Sentry — nunca somar com a tabela acima.',
				headers: ['URL', 'Erros de script'],
				rows: clarityScriptErrors.map((p) => [p.url, p.count]),
			},
		],
	};
}

export function buildReportsReport(params: {
	points: DailyPoint[];
	weeks: RollupRow[];
	months: RollupRow[];
	sessionsBaseline: Baseline | null;
	occurrencesBaseline: Baseline | null;
	bookingBaseline: Baseline | null;
	scenario: Scenario | null;
}): ReportDocument {
	const { points, weeks, months, sessionsBaseline, occurrencesBaseline, bookingBaseline, scenario } = params;
	const sections: ReportDocument['sections'] = [];

	if (scenario) {
		sections.push({
			kind: 'text',
			heading: `Cenário ${scenario.code} — ${scenario.label}`,
			body: `${scenario.description}\n\nEvidência: ${scenario.evidence.join(' · ')}`,
		});
	}

	sections.push({
		kind: 'table',
		heading: `Diário (últimos ${points.length} dia(s))`,
		headers: ['Data', 'Sessões (Clarity)', 'Ocorrências (Sentry)', 'Chegadas em agendamento'],
		rows: points.map((p) => [p.date, p.claritySessions ?? '—', p.sentryOccurrences ?? '—', p.bookingArrivals ?? '—']),
	});

	sections.push({
		kind: 'table',
		heading: 'Semanal',
		headers: ['Semana (segunda-feira)', 'Sessões', 'Ocorrências', 'Erros de script', 'Agendamentos'],
		rows: weeks.map((w) => [w.key, w.claritySessions, w.sentryOccurrences, w.clarityScriptErrors, w.bookingArrivals]),
	});

	sections.push({
		kind: 'table',
		heading: 'Mensal',
		headers: ['Mês', 'Sessões', 'Ocorrências', 'Erros de script', 'Agendamentos'],
		rows: months.map((m) => [m.key, m.claritySessions, m.sentryOccurrences, m.clarityScriptErrors, m.bookingArrivals]),
	});

	sections.push({
		kind: 'kpi',
		heading: 'Baseline (comportamento normal)',
		items: [
			{ label: 'Sessões — média', value: sessionsBaseline ? sessionsBaseline.avg.toFixed(0) : '—' },
			{ label: 'Sessões — maior', value: sessionsBaseline?.max ?? '—' },
			{ label: 'Sessões — menor', value: sessionsBaseline?.min ?? '—' },
			{ label: 'Ocorrências — média', value: occurrencesBaseline ? occurrencesBaseline.avg.toFixed(0) : '—' },
			{ label: 'Ocorrências — maior', value: occurrencesBaseline?.max ?? '—' },
			{ label: 'Ocorrências — menor', value: occurrencesBaseline?.min ?? '—' },
			{ label: 'Agendamentos — média', value: bookingBaseline ? bookingBaseline.avg.toFixed(0) : '—' },
			{ label: 'Agendamentos — maior', value: bookingBaseline?.max ?? '—' },
			{ label: 'Agendamentos — menor', value: bookingBaseline?.min ?? '—' },
		],
	});

	return {
		title: 'Relatórios diários — Comparativos',
		subtitle: `${points.length} dia(s) de histórico disponível`,
		generatedAt: new Date(),
		sections,
	};
}

export function buildRouteComparisonReport(params: {
	route: string;
	issues: SentryIssue[];
	totalOccurrences: number;
	clarity: ClarityInsights | null;
}): ReportDocument {
	const { route, issues, totalOccurrences, clarity } = params;
	const sorted = [...issues].sort((a, b) => b.count - a.count);

	return {
		title: `Rota: ${route}`,
		subtitle: 'Sentry: is:unresolved, últimos resultados',
		generatedAt: new Date(),
		sections: [
			{
				kind: 'kpi',
				heading: 'Resumo',
				items: [
					{ label: 'Issues (Sentry)', value: issues.length },
					{ label: 'Ocorrências', value: totalOccurrences },
					{ label: 'Sessões (Clarity)', value: clarity?.totalSessions ?? '—' },
					{ label: 'Erros de script (Clarity)', value: clarity ? `${clarity.scriptErrorPercent}%` : '—' },
				],
			},
			{
				kind: 'table',
				heading: 'Erros desta rota',
				headers: ['Título', 'Ocorrências'],
				rows: sorted.map((i) => [i.title, i.count]),
			},
		],
	};
}
