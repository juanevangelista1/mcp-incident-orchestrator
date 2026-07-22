import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchClarityInsightsInputSchema } from '../clarity.schema.js';
import { ClarityService } from '../clarity.service.js';

// Plugin: Insights do Clarity — a "lupa do usuário". Enquanto Sentry mostra a exceção
// e Datadog mostra a infraestrutura, o Clarity mostra como pessoas de verdade reagiram
// (rage clicks, dead clicks) e quais páginas concentram tráfego — o terceiro ângulo do incidente.
export function registerFetchClarityInsightsTool(server: McpServer, clarityService: ClarityService): void {
	server.tool(
		'fetch_clarity_insights',
		'Busca insights agregados do Microsoft Clarity: sessões, rage/dead clicks, erros de script e páginas mais visitadas (últimos 1 a 3 dias).',
		fetchClarityInsightsInputSchema.shape,
		async (args) => {
			try {
				const insights = await clarityService.fetchInsights(args);

				const topPagesReport = insights.topPages
					.map((p, i) => `${i + 1}. ${p.url} — ${p.sessions} sessão(ões)`)
					.join('\n');

				const report =
					`Insights do Clarity (últimos ${args.numOfDays} dia(s)):\n` +
					`- Sessões: ${insights.totalSessions}\n` +
					`- Rage clicks: ${insights.rageClicks}\n` +
					`- Dead clicks: ${insights.deadClicks}\n` +
					`- Erros de script: ${insights.scriptErrors}\n\n` +
					`Páginas mais visitadas:\n${topPagesReport || 'Nenhuma página encontrada.'}`;

				return { content: [{ type: 'text', text: report }] };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
