import type { ReportDocument } from './types';
import type { ClarityInsights, Ga4Summary, SentryIssue, SentryIssueDetails } from '@/lib/mcp-types';
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
	ga4?: Ga4Summary | null;
}): ReportDocument {
	const { data, numOfDays, urlFilter, deviceFilter, ga4 } = params;
	const filters = [urlFilter && `URL: ${urlFilter}`, deviceFilter && `Dispositivo: ${deviceFilter}`]
		.filter(Boolean)
		.join(' · ');

	const sections: ReportDocument['sections'] = [
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
	];

	if (ga4) {
		sections.push({
			kind: 'kpi',
			heading: 'Conversão real — Google Analytics 4 (não somar com o resto deste relatório)',
			items: [
				{ label: 'Sessões (GA4)', value: ga4.sessions },
				{ label: 'Usuários (GA4)', value: ga4.totalUsers },
				{
					label: `Conversões${ga4.conversionEventName ? ` (${ga4.conversionEventName})` : ''}`,
					value: ga4.conversions ?? '—',
				},
			],
		});
	}

	sections.push(
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
	);

	return {
		title: 'Insights — Microsoft Clarity',
		subtitle: `Últimos ${numOfDays} dia(s)${filters ? ` — ${filters}` : ''}`,
		generatedAt: new Date(),
		sections,
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
	ga4ConversionsBaseline: Baseline | null;
	scenario: Scenario | null;
	// Texto já gerado pelo NarrativeReport (Sintoma->Evidência->...->Ação) — opcional porque é
	// gerado sob demanda; sem ele, o documento sai só com os números (comportamento anterior).
	narrative?: string;
}): ReportDocument {
	const {
		points,
		weeks,
		months,
		sessionsBaseline,
		occurrencesBaseline,
		bookingBaseline,
		ga4ConversionsBaseline,
		scenario,
		narrative,
	} = params;
	const sections: ReportDocument['sections'] = [];

	if (scenario) {
		sections.push({
			kind: 'text',
			heading: `Cenário ${scenario.code} — ${scenario.label}`,
			body: `${scenario.description}\n\nEvidência: ${scenario.evidence.join(' · ')}`,
		});
	}

	if (narrative) {
		sections.push({
			kind: 'text',
			heading: 'Relatório narrativo (Gemini) — Sintoma → Evidência → Hipótese → Investigação → Correlação → Causa provável → Impacto → Ação recomendada',
			body: narrative,
		});
	}

	sections.push({
		kind: 'table',
		heading: `Diário (últimos ${points.length} dia(s))`,
		headers: ['Data', 'Sessões (Clarity)', 'Ocorrências (Sentry)', 'Chegadas em agendamento (proxy)', 'Conversões (GA4, real)'],
		rows: points.map((p) => [
			p.date,
			p.claritySessions ?? '—',
			p.sentryOccurrences ?? '—',
			p.bookingArrivals ?? '—',
			p.ga4Conversions ?? '—',
		]),
	});

	sections.push({
		kind: 'table',
		heading: 'Semanal',
		headers: ['Semana (segunda-feira)', 'Sessões', 'Ocorrências', 'Erros de script', 'Agendamentos (proxy)', 'Conversões (GA4, real)'],
		rows: weeks.map((w) => [
			w.key,
			w.claritySessions,
			w.sentryOccurrences,
			w.clarityScriptErrors,
			w.bookingArrivals,
			w.ga4Conversions,
		]),
	});

	sections.push({
		kind: 'table',
		heading: 'Mensal',
		headers: ['Mês', 'Sessões', 'Ocorrências', 'Erros de script', 'Agendamentos (proxy)', 'Conversões (GA4, real)'],
		rows: months.map((m) => [
			m.key,
			m.claritySessions,
			m.sentryOccurrences,
			m.clarityScriptErrors,
			m.bookingArrivals,
			m.ga4Conversions,
		]),
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
			{ label: 'Agendamentos (proxy) — média', value: bookingBaseline ? bookingBaseline.avg.toFixed(0) : '—' },
			{ label: 'Agendamentos (proxy) — maior', value: bookingBaseline?.max ?? '—' },
			{ label: 'Agendamentos (proxy) — menor', value: bookingBaseline?.min ?? '—' },
			{
				label: 'Conversões GA4 (real) — média',
				value: ga4ConversionsBaseline ? ga4ConversionsBaseline.avg.toFixed(0) : '—',
			},
			{ label: 'Conversões GA4 (real) — maior', value: ga4ConversionsBaseline?.max ?? '—' },
			{ label: 'Conversões GA4 (real) — menor', value: ga4ConversionsBaseline?.min ?? '—' },
		],
	});

	return {
		title: 'Relatórios diários — Comparativos',
		subtitle: `${points.length} dia(s) de histórico disponível`,
		generatedAt: new Date(),
		sections,
	};
}

export interface ChatConversationEntry {
	question: string;
	answer: string;
	geminiAnalysis?: string;
}

// Exporta a conversa acumulada no chat de perguntas estáticas (chat/page.tsx) — cada entrada
// já é texto pronto (resposta instantânea + análise Gemini opcional, gerada sob demanda),
// nenhum dado novo é buscado aqui.
export function buildChatConversationReport(conversation: ChatConversationEntry[]): ReportDocument {
	return {
		title: 'Chat — Perguntas e respostas',
		subtitle: `${conversation.length} pergunta(s) respondida(s) nesta sessão`,
		generatedAt: new Date(),
		sections: conversation.map((entry) => ({
			kind: 'text',
			heading: entry.question,
			body: entry.geminiAnalysis ? `${entry.answer}\n\nAnálise Gemini:\n${entry.geminiAnalysis}` : entry.answer,
		})),
	};
}

// A página /issues/[id] não tinha nenhum botão de exportar — só o texto de investigação na
// tela (quando gerado). `narrative` opcional pelo mesmo motivo do buildReportsReport: pode
// ser exportado antes ou depois de o usuário clicar em "Gerar investigação completa".
export function buildIssueReport(params: { details: SentryIssueDetails; narrative?: string }): ReportDocument {
	const { details, narrative } = params;
	const sections: ReportDocument['sections'] = [
		{
			kind: 'kpi',
			heading: 'Erro',
			items: [
				{ label: 'Mensagem', value: details.errorMessage },
				{ label: 'ID', value: details.id },
				{ label: 'Navegador', value: details.context.browser ?? '—' },
				{ label: 'Sistema', value: details.context.os ?? '—' },
				{ label: 'Dispositivo', value: details.context.device ?? '—' },
				{ label: 'Localização', value: details.context.location ?? '—' },
			],
		},
	];

	if (narrative) {
		sections.push({
			kind: 'text',
			heading: 'Investigação completa (Gemini) — Sintoma → Evidência → Hipótese → Investigação → Correlação → Causa provável → Impacto → Ação recomendada',
			body: narrative,
		});
	}

	if (Object.keys(details.tags).length > 0) {
		sections.push({
			kind: 'table',
			heading: 'Tags',
			headers: ['Chave', 'Valor'],
			rows: Object.entries(details.tags),
		});
	}

	sections.push({
		kind: 'text',
		heading: 'Stack trace',
		body: details.stackTrace.join('\n') || 'Sem stack trace disponível.',
	});

	return {
		title: `Erro: ${details.errorMessage}`,
		subtitle: `ID: ${details.id}`,
		generatedAt: new Date(),
		sections,
	};
}

export function buildRouteComparisonReport(params: {
	route: string;
	issues: SentryIssue[];
	totalOccurrences: number;
	clarity: ClarityInsights | null;
	ga4?: Ga4Summary | null;
}): ReportDocument {
	const { route, issues, totalOccurrences, clarity, ga4 } = params;
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
					{ label: 'Sessões (GA4, real)', value: ga4?.sessions ?? '—' },
					{ label: 'Conversões (GA4, real)', value: ga4?.conversions ?? '—' },
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

export interface RouteComparisonSnapshot {
	route: string;
	issues: SentryIssue[];
	totalOccurrences: number;
	clarity: ClarityInsights | null;
	ga4: Ga4Summary | null;
}

// Bundla as duas rotas comparadas + a análise Gemini (Sintoma->...->Ação) num só documento —
// os botões de export individuais por rota (buildRouteComparisonReport) continuam existindo
// à parte, esse aqui é o "exportar tudo" da comparação inteira.
export function buildRouteComparisonFullReport(params: {
	snapshotA: RouteComparisonSnapshot;
	snapshotB: RouteComparisonSnapshot;
	narrative?: string;
}): ReportDocument {
	const { snapshotA, snapshotB, narrative } = params;

	const kpiFor = (s: RouteComparisonSnapshot) => [
		{ label: `${s.route} — Issues (Sentry)`, value: s.issues.length },
		{ label: `${s.route} — Ocorrências`, value: s.totalOccurrences },
		{ label: `${s.route} — Sessões (Clarity)`, value: s.clarity?.totalSessions ?? '—' },
		{ label: `${s.route} — Sessões (GA4, real)`, value: s.ga4?.sessions ?? '—' },
		{ label: `${s.route} — Conversões (GA4, real)`, value: s.ga4?.conversions ?? '—' },
	];

	const sections: ReportDocument['sections'] = [
		{ kind: 'kpi', heading: 'Resumo — Rota A', items: kpiFor(snapshotA) },
		{ kind: 'kpi', heading: 'Resumo — Rota B', items: kpiFor(snapshotB) },
	];

	if (narrative) {
		sections.push({
			kind: 'text',
			heading: 'Comparação (Gemini) — Sintoma → Evidência → Hipótese → Investigação → Correlação → Causa provável → Impacto → Ação recomendada',
			body: narrative,
		});
	}

	for (const s of [snapshotA, snapshotB]) {
		sections.push({
			kind: 'table',
			heading: `Erros — ${s.route}`,
			headers: ['Título', 'Ocorrências'],
			rows: [...s.issues].sort((a, b) => b.count - a.count).map((i) => [i.title, i.count]),
		});
	}

	return {
		title: `Comparação: ${snapshotA.route} vs. ${snapshotB.route}`,
		subtitle: 'Sentry (is:unresolved) + Clarity (proxy) + GA4 (real)',
		generatedAt: new Date(),
		sections,
	};
}
