import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchClarityRegionInsightsInputSchema, clarityRegionInsightsSchema } from '../clarity.schema.js';
import { ClarityService } from '../clarity.service.js';

// Plugin: breakdown de sessões por sistema operacional e país. Deliberadamente separado da
// tool `fetch_clarity_insights` (dimensões diferentes, mesma cota de 10 req/dia do Clarity) —
// pensado para ser chamado só 1x/dia pelo digest, não pela navegação normal do dashboard.
export function registerFetchClarityRegionInsightsTool(server: McpServer, clarityService: ClarityService): void {
	server.registerTool(
		'fetch_clarity_region_insights',
		{
			description:
				'Busca sessões do Microsoft Clarity agrupadas por sistema operacional e país (últimos 1 a 3 dias). ' +
				'Prefira usar isso no máximo 1x/dia (ex: no digest diário) — soma à mesma cota de 10 requisições/dia do fetch_clarity_insights.',
			inputSchema: fetchClarityRegionInsightsInputSchema.shape,
			outputSchema: clarityRegionInsightsSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const insights = await clarityService.fetchRegionBreakdown(args);

				const osReport = insights.sessionsByOS.map((o) => `${o.os}: ${o.count} sessão(ões)`).join(', ');
				const countryReport = insights.sessionsByCountry
					.map((c) => `${c.country}: ${c.count} sessão(ões)`)
					.join(', ');

				const report =
					`Sessões por sistema operacional: ${osReport || 'sem dados'}\n` +
					`Sessões por país: ${countryReport || 'sem dados'}`;

				return { content: [{ type: 'text', text: report }], structuredContent: insights };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
