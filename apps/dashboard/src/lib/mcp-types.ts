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

export interface DatadogLogEntry {
	id: string;
	timestamp: string;
	service: string;
	status: string;
	message: string;
	host: string;
}

export interface DatadogLogDetails extends DatadogLogEntry {
	tags: Record<string, string>;
}

export interface DatadogLogsSummary {
	totalLogs: number;
	byStatus: { status: string; count: number }[];
	byService: { service: string; count: number }[];
}

export interface ClarityInsights {
	totalSessions: number;
	rageClicks: number;
	deadClicks: number;
	scriptErrors: number;
	topPages: { url: string; sessions: number }[];
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
