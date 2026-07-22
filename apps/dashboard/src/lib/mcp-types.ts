// Espelham o `structuredContent` das tools do MCP server (apps/mcp-server/src/*.schema.ts).
// Duplicados aqui de propósito: o dashboard não importa código do mcp-server, só fala com
// ele pela rede (ver decisão de arquitetura no plano da Fase 2) — então os tipos são
// mantidos em espelho, não compartilhados por import direto.

export interface SentryIssuesSummary {
	totalIssues: number;
	totalOccurrences: number;
	topCulprits: { culprit: string; count: number }[];
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
