import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue, ClarityInsights, Ga4Summary, DatadogErrorIssue } from '@/lib/mcp-types';
import { groupBookingEvents, type BookingEventGroups } from '@/lib/ga4-booking-events';

export interface RouteSnapshot {
	route: string;
	issues: SentryIssue[];
	totalOccurrences: number;
	sentryError: string | null;
	clarity: ClarityInsights | null;
	clarityError: string | null;
	ga4: Ga4Summary | null;
	ga4Error: string | null;
	// Agendamentos (locação/venda) restritos às sessões desta rota (pagePath CONTAINS route,
	// mesmo filtro do resto do snapshot).
	bookingEvents: BookingEventGroups | null;
	// Mesmos eventos, mas sem o filtro de pagePath — comparação pro caso do fluxo de
	// agendamento não acontecer numa URL própria (ex: modal sobre a página do imóvel), onde
	// `bookingEvents` filtrado pela rota digitada vem zerado mesmo tendo agendamentos reais.
	bookingEventsSiteWide: BookingEventGroups | null;
	// true quando o filtro por rota zera os agendamentos mas o total do site no mesmo período
	// não é zero — sinal de que a rota digitada provavelmente não é a URL onde o evento dispara.
	bookingEventsRouteMismatch: boolean;
	// Ocorrências Sentry ÷ sessões GA4 da rota, em %. Heurística (não é uma taxa de erro
	// "oficial" de nenhuma das duas fontes): serve pra notar rotas com volume de erro alto
	// relativo ao tráfego, que um número absoluto de ocorrências sozinho não deixa óbvio.
	errorRatePercent: number | null;
	datadogIssues: DatadogErrorIssue[];
	datadogError: string | null;
}

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

function daysBetween(startDate?: string, endDate?: string): number {
	if (!startDate || !endDate) return 3;
	const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
	return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

// Busca Sentry (obrigatório, mas com tratativa — não deixa a página quebrar se o MCP server
// estiver fora) + Clarity + GA4 + Datadog (melhor esforço, cada um com sua própria mensagem de
// erro em vez de falhar silenciosamente). `startDate`/`endDate` (AAAA-MM-DD) são opcionais —
// quando ausentes, cada fonte usa sua janela padrão (Sentry: sem filtro de data; Clarity: 3
// dias; GA4: 7 dias), preservando o comportamento de quem já chamava sem período customizado.
export async function fetchRouteSnapshot(params: {
	route: string;
	startDate?: string;
	endDate?: string;
}): Promise<RouteSnapshot> {
	const { route, startDate, endDate } = params;

	let issues: SentryIssue[] = [];
	let sentryError: string | null = null;
	try {
		const { data } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
			projectSlug: PROJECT_SLUG,
			route,
			startDate,
			endDate,
			limit: 100,
		});
		issues = data?.issues ?? [];
	} catch (error) {
		sentryError = error instanceof Error ? error.message : 'Sentry indisponível.';
	}
	const totalOccurrences = issues.reduce((sum, i) => sum + i.count, 0);

	let clarity: ClarityInsights | null = null;
	let clarityError: string | null = null;
	try {
		// A API do Clarity só aceita 1–3 dias por chamada — quando um período maior é pedido,
		// consultamos a janela máxima (3 dias mais recentes) em vez de rejeitar o pedido.
		const numOfDays = Math.min(3, Math.max(1, daysBetween(startDate, endDate)));
		const clarityResult = await callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays, url: route });
		clarity = clarityResult.data ?? null;
		if (!clarity) clarityError = clarityResult.text;
	} catch (error) {
		clarityError = error instanceof Error ? error.message : 'Clarity indisponível.';
	}

	let ga4: Ga4Summary | null = null;
	let ga4Error: string | null = null;
	try {
		const ga4Result = await callMcpTool<Ga4Summary>('fetch_ga4_summary', {
			numOfDays: 7,
			startDate,
			endDate,
			pagePath: route,
		});
		ga4 = ga4Result.data ?? null;
		if (!ga4) ga4Error = ga4Result.text;
	} catch (error) {
		ga4Error = error instanceof Error ? error.message : 'GA4 indisponível.';
	}

	const bookingEvents = ga4 ? groupBookingEvents(ga4.eventsByName) : null;

	// Só busca o site inteiro (sem pagePath) se a versão filtrada pela rota veio zerada — não
	// gasta uma segunda chamada à API do GA4 à toa quando a rota já tem agendamentos normalmente.
	let bookingEventsSiteWide: BookingEventGroups | null = null;
	if (bookingEvents && bookingEvents.total === 0) {
		try {
			const siteWideResult = await callMcpTool<Ga4Summary>('fetch_ga4_summary', {
				numOfDays: 7,
				startDate,
				endDate,
			});
			bookingEventsSiteWide = siteWideResult.data ? groupBookingEvents(siteWideResult.data.eventsByName) : null;
		} catch {
			// Melhor esforço só pra essa comparação — se falhar, segue sem o aviso de mismatch.
		}
	}
	const bookingEventsRouteMismatch = bookingEvents?.total === 0 && (bookingEventsSiteWide?.total ?? 0) > 0;

	let datadogIssues: DatadogErrorIssue[] = [];
	let datadogError: string | null = null;
	try {
		const minutesAgo = Math.min(10080, daysBetween(startDate, endDate) * 1440);
		const datadogResult = await callMcpTool<{ issues: DatadogErrorIssue[] }>('fetch_datadog_error_issues', {
			query: `resource_name:*${route}*`,
			minutesAgo,
			limit: 20,
		});
		datadogIssues = datadogResult.data?.issues ?? [];
	} catch (error) {
		datadogError = error instanceof Error ? error.message : 'Datadog não configurado no MCP server.';
	}

	const errorRatePercent = ga4 && ga4.sessions > 0 ? (totalOccurrences / ga4.sessions) * 100 : null;

	return {
		route,
		issues,
		totalOccurrences,
		sentryError,
		clarity,
		clarityError,
		ga4,
		ga4Error,
		bookingEvents,
		bookingEventsSiteWide,
		bookingEventsRouteMismatch,
		errorRatePercent,
		datadogIssues,
		datadogError,
	};
}
