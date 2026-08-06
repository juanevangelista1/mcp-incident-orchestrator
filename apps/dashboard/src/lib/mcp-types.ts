// Espelham o `structuredContent` das tools do MCP server (apps/mcp-server/src/*.schema.ts).
// Duplicados aqui de propósito: o dashboard não importa código do mcp-server, só fala com
// ele pela rede (ver decisão de arquitetura no plano da Fase 2) — então os tipos são
// mantidos em espelho, não compartilhados por import direto.

export interface SentryIssue {
	id: string;
	title: string;
	culprit: string;
	count: number;
	permalink: string;
}

export interface SentryIssueDetails {
	id: string;
	errorMessage: string;
	stackTrace: string[];
	tags: Record<string, string>;
	context: {
		browser?: string;
		os?: string;
		device?: string;
		locale?: string;
		timezone?: string;
		location?: string;
	};
	request?: {
		url?: string;
		method?: string;
		userAgent?: string;
		referer?: string;
	};
	breadcrumbs: { timestamp: string; category: string; level: string; description: string }[];
}

export interface SentryIssuesSummary {
	totalIssues: number;
	totalOccurrences: number;
	topCulprits: { culprit: string; count: number }[];
}

export interface DatadogErrorIssue {
	id: string;
	errorMessage: string;
	errorType: string;
	service: string;
	platform: string;
	state: string;
	isCrash: boolean;
	firstSeen: string;
	lastSeen: string;
	totalCount: number;
}

// Agregado client-side em mcp-summaries.ts a partir de fetch_datadog_error_issues — não é
// uma tool própria do mcp-server (não precisa: os dados já vêm todos numa chamada só).
export interface DatadogErrorSummary {
	totalIssues: number;
	totalOccurrences: number;
	byService: { service: string; count: number }[];
	topIssues: { label: string; count: number }[];
}

export interface ClarityInsights {
	totalSessions: number;
	rageClicks: number;
	deadClicks: number;
	scriptErrors: number;
	rageClickPercent: number;
	deadClickPercent: number;
	scriptErrorPercent: number;
	excessiveScrollSessions: number;
	excessiveScrollPercent: number;
	quickBackSessions: number;
	quickBackPercent: number;
	topPages: { url: string; sessions: number }[];
	rageClicksByPage: { url: string; count: number }[];
	deadClicksByPage: { url: string; count: number }[];
	scriptErrorsByPage: { url: string; count: number }[];
	sessionsByDevice: { device: string; count: number }[];
	sessionsByBrowser: { browser: string; count: number }[];
	lowEngagementSessions: number;
}

export interface ClarityRegionInsights {
	sessionsByOS: { os: string; count: number }[];
	sessionsByCountry: { country: string; count: number }[];
}

export interface AwsLogEntry {
	id: string;
	timestamp: string;
	logStreamName: string;
	message: string;
}

export interface AwsLogDetails extends AwsLogEntry {
	tags: Record<string, string>;
}

export interface AwsLogsSummary {
	totalEvents: number;
	byLogStream: { logStreamName: string; count: number }[];
}

export interface Ga4Summary {
	sessions: number;
	totalUsers: number;
	// `null` quando GA4_CONVERSION_EVENT_NAME não está configurado no mcp-server — sem
	// fallback para "key events" genéricos, só o evento de conversão real, quando existir.
	conversions: number | null;
	conversionEventName: string | null;
	topPagesBySessions: { page: string; sessions: number }[];
	sessionsByDevice: { device: string; sessions: number }[];
}
