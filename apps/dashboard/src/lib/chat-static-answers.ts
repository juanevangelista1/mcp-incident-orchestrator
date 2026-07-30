import { ClarityInsights, Ga4Summary, SentryIssue } from '@/lib/mcp-types';
import { classifySeverity, rankPagesByOccurrences } from '@/lib/error-severity';
import { DailyPoint, RollupRow, Baseline, baseline, percentChange } from '@/lib/trends';
import { Scenario } from '@/lib/scenarios';

export interface StaticAnswer {
	id: string;
	question: string;
	answer: string;
	// Perguntas de causa/relação/monitoramento têm resposta instantânea (determinística, a
	// partir de `scenario`), mas também podem ganhar uma análise em prosa gerada pelo Gemini,
	// sob demanda — nunca automática (ver chat/page.tsx).
	narrativeCapable?: boolean;
	link?: { href: string; label: string };
}

export interface StaticAnswersContext {
	sentryIssues: SentryIssue[];
	clarity: ClarityInsights | null;
	ga4: Ga4Summary | null;
	points: DailyPoint[];
	weeks: RollupRow[];
	months: RollupRow[];
	scenario: Scenario | null;
}

const NO_DATA = 'sem dado disponível';

function fmtPercent(value: number | null): string {
	if (value === null) return NO_DATA;
	return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function fmtBaseline(label: string, b: Baseline | null): string {
	if (!b) return `${label}: ${NO_DATA}`;
	return `${label}: média ${b.avg.toFixed(0)}, maior ${b.max}, menor ${b.min}`;
}

// 100% determinístico — nenhuma chamada ao Gemini. Reaproveita os mesmos cálculos já usados
// em /issues, /insights e /reports (classifySeverity, rankPagesByOccurrences, baseline,
// percentChange, scenarios.ts), só recompostos em texto direto para as 17 perguntas do
// pedido original do usuário.
export function buildStaticAnswers(ctx: StaticAnswersContext): StaticAnswer[] {
	const { sentryIssues, clarity, ga4, points, weeks, months, scenario } = ctx;

	const ranked = classifySeverity(sentryIssues);
	const pageRank = rankPagesByOccurrences(sentryIssues, 5);
	const totalOccurrences = sentryIssues.reduce((sum, i) => sum + i.count, 0);

	const lastDay = points.at(-1);
	const prevDay = points.at(-2);
	const lastWeek = weeks.at(-1);
	const prevWeek = weeks.at(-2);
	const lastMonth = months.at(-1);
	const prevMonth = months.at(-2);

	const sessionsBaseline = baseline(points, 'claritySessions');
	const occurrencesBaseline = baseline(points, 'sentryOccurrences');

	const conversionRate = (p: DailyPoint | undefined) =>
		p?.bookingArrivals != null && p.claritySessions ? (p.bookingArrivals / p.claritySessions) * 100 : null;
	const avgConversionRate = (() => {
		const rates = points.map(conversionRate).filter((r): r is number => r !== null);
		return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
	})();

	const critical = ranked.filter((i) => i.severity === 'Crítico').slice(0, 5);

	const answers: StaticAnswer[] = [
		{
			id: 'o-que-aconteceu',
			question: 'O que aconteceu na aplicação recentemente?',
			answer:
				`${sentryIssues.length} issue(s) não resolvidas no Sentry (${totalOccurrences} ocorrências). ` +
				(clarity ? `${clarity.totalSessions} sessão(ões) no Clarity (últimos dias). ` : '') +
				(ga4 ? `${ga4.sessions} sessão(ões) e ${ga4.totalUsers} usuário(s) no GA4. ` : '') +
				(scenario ? `Cenário detectado no último dia: ${scenario.label}.` : ''),
			link: { href: '/reports', label: 'Ver comparativos completos' },
		},
		{
			id: 'quantas-sessoes',
			question: 'Quantas sessões/usuários tivemos?',
			answer:
				(clarity ? `Clarity: ${clarity.totalSessions} sessão(ões). ` : `Clarity: ${NO_DATA}. `) +
				(ga4 ? `GA4: ${ga4.sessions} sessão(ões), ${ga4.totalUsers} usuário(s).` : `GA4: ${NO_DATA}.`),
			link: { href: '/insights', label: 'Ver Insights (Clarity)' },
		},
		{
			id: 'paginas-mais-acessadas',
			question: 'Quais as páginas mais acessadas?',
			answer: clarity?.topPages.length
				? clarity.topPages.map((p, i) => `${i + 1}. ${p.url} — ${p.sessions} sessão(ões)`).join('\n')
				: NO_DATA,
			link: { href: '/insights', label: 'Ver Insights (Clarity)' },
		},
		{
			id: 'leads-agendamentos',
			question: 'Quantos leads/agendamentos tivemos?',
			answer:
				`Chegadas em agendamento (proxy, Clarity): ${lastDay?.bookingArrivals ?? NO_DATA}. ` +
				`Conversões reais (evento GA4${ga4?.conversionEventName ? ` '${ga4.conversionEventName}'` : ''}): ${
					lastDay?.ga4Conversions ?? NO_DATA
				}.`,
			link: { href: '/insights/agendamento', label: 'Ver funil de agendamento' },
		},
		{
			id: 'taxa-conversao',
			question: 'Qual a taxa média de conversão?',
			answer:
				avgConversionRate !== null
					? `${avgConversionRate.toFixed(1)}% (proxy: chegadas em agendamento ÷ sessões Clarity, média do período disponível).`
					: NO_DATA,
			link: { href: '/reports', label: 'Ver gráfico de conversão' },
		},
		{
			id: 'media-diaria',
			question: 'Qual a média diária de sessões e erros?',
			answer: [fmtBaseline('Sessões (Clarity)', sessionsBaseline), fmtBaseline('Ocorrências (Sentry)', occurrencesBaseline)].join(
				' · ',
			),
		},
		{
			id: 'media-semanal',
			question: 'Qual a média semanal?',
			answer:
				weeks.length > 0
					? `Sessões: ${(weeks.reduce((s, w) => s + w.claritySessions, 0) / weeks.length).toFixed(0)}/semana · ` +
						`Ocorrências: ${(weeks.reduce((s, w) => s + w.sentryOccurrences, 0) / weeks.length).toFixed(0)}/semana`
					: NO_DATA,
			link: { href: '/reports', label: 'Ver comparativo semanal' },
		},
		{
			id: 'media-mensal',
			question: 'Qual a média mensal?',
			answer:
				months.length > 0
					? `Sessões: ${(months.reduce((s, m) => s + m.claritySessions, 0) / months.length).toFixed(0)}/mês · ` +
						`Ocorrências: ${(months.reduce((s, m) => s + m.sentryOccurrences, 0) / months.length).toFixed(0)}/mês`
					: NO_DATA,
			link: { href: '/reports', label: 'Ver comparativo mensal' },
		},
		{
			id: 'comparacao-periodo-anterior',
			question: 'Como estamos em relação ao período anterior?',
			answer:
				`Dia anterior — Sessões: ${fmtPercent(percentChange(lastDay?.claritySessions ?? null, prevDay?.claritySessions ?? null))}, ` +
				`Erros: ${fmtPercent(percentChange(lastDay?.sentryOccurrences ?? null, prevDay?.sentryOccurrences ?? null))}, ` +
				`Agendamento (proxy): ${fmtPercent(percentChange(lastDay?.bookingArrivals ?? null, prevDay?.bookingArrivals ?? null))}, ` +
				`Conversões GA4 (real): ${fmtPercent(percentChange(lastDay?.ga4Conversions ?? null, prevDay?.ga4Conversions ?? null))}` +
				(lastWeek && prevWeek
					? `\nSemana anterior — Sessões: ${fmtPercent(percentChange(lastWeek.claritySessions, prevWeek.claritySessions))}`
					: '') +
				(lastMonth && prevMonth
					? `\nMês anterior — Sessões: ${fmtPercent(percentChange(lastMonth.claritySessions, prevMonth.claritySessions))}`
					: ''),
			link: { href: '/reports', label: 'Ver comparativos' },
		},
		{
			id: 'erros-js',
			question: 'Quantos erros de JavaScript (frontend) tivemos?',
			answer: clarity
				? `${clarity.scriptErrors} sessão(ões) com erro de script (${clarity.scriptErrorPercent}% das sessões, Clarity).`
				: NO_DATA,
			link: { href: '/insights', label: 'Ver Insights (Clarity)' },
		},
		{
			id: 'erros-mais-criticos',
			question: 'Quais os erros mais críticos agora?',
			answer: critical.length
				? critical.map((i, idx) => `${idx + 1}. ${i.title} (${i.count} ocorrências) — /issues/${i.id}`).join('\n')
				: 'Nenhum erro classificado como Crítico no conjunto atual.',
			link: { href: '/issues', label: 'Ver todas as issues' },
		},
		{
			id: 'paginas-com-problema',
			question: 'Quais páginas têm mais problema?',
			answer: pageRank.length
				? pageRank.map((r, i) => `${i + 1}. ${r.page} — ${r.sentryOccurrences} ocorrência(s)`).join('\n')
				: NO_DATA,
			link: { href: '/issues/comparar', label: 'Comparar rotas' },
		},
		{
			id: 'dispositivo-navegador-afetado',
			question: 'Qual dispositivo/navegador é mais afetado?',
			answer: clarity
				? `Dispositivo: ${clarity.sessionsByDevice.map((d) => `${d.device} (${d.count})`).join(', ') || NO_DATA}. ` +
					`Navegador: ${clarity.sessionsByBrowser.map((b) => `${b.browser} (${b.count})`).join(', ') || NO_DATA}.`
				: NO_DATA,
			link: { href: '/insights', label: 'Ver Insights (Clarity)' },
		},
		{
			id: 'relacao-erro-conversao',
			question: 'Existe relação entre os erros e a conversão?',
			answer: scenario
				? `Cenário ${scenario.code} — ${scenario.label}. ${scenario.description} Evidência: ${scenario.evidence.join(' · ') || NO_DATA}.`
				: `Sem baseline suficiente ainda (precisa de pelo menos 2 dias de digest).`,
			narrativeCapable: true,
		},
		{
			id: 'causa-tecnica-vs-trafego',
			question: 'A variação foi causada por problema técnico ou por tráfego/comportamento?',
			answer: scenario
				? `Classificação determinística: ${scenario.label} (cenário ${scenario.code}). ${scenario.description}`
				: `Sem baseline suficiente ainda.`,
			narrativeCapable: true,
		},
		{
			id: 'evidencias-conclusao',
			question: 'Qual evidência sustenta essa conclusão?',
			answer: scenario?.evidence.length ? scenario.evidence.join(' · ') : NO_DATA,
		},
		{
			id: 'o-que-monitorar',
			question: 'O que devemos monitorar daqui pra frente?',
			answer: scenario
				? `Com base no cenário atual (${scenario.label}), monitore as mesmas métricas que sustentam essa classificação: ${scenario.evidence.map((e) => e.split(':')[0]).join(', ')}. Para uma recomendação mais específica, gere a análise com Gemini abaixo.`
				: 'Ainda não há cenário suficiente para recomendar — acompanhe sessões, erros e conversões por mais alguns dias.',
			narrativeCapable: true,
		},
	];

	return answers;
}
