import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchClarityInsightsInputSchema, clarityInsightsSchema } from '../clarity.schema.js';
import { ClarityService } from '../clarity.service.js';

// Plugin: Insights do Clarity — a "lupa do usuário". Enquanto Sentry mostra a exceção
// e Datadog mostra a infraestrutura, o Clarity mostra como pessoas de verdade reagiram
// (rage clicks, dead clicks) e quais páginas concentram tráfego — o terceiro ângulo do incidente.
export function registerFetchClarityInsightsTool(server: McpServer, clarityService: ClarityService): void {
	server.registerTool(
		'fetch_clarity_insights',
		{
			description:
				'Busca insights agregados do Microsoft Clarity: sessões, rage/dead clicks, erros de script e páginas mais visitadas (últimos 1 a 3 dias). Aceita filtro opcional por url e/ou device (dispositivo).',
			inputSchema: fetchClarityInsightsInputSchema.shape,
			outputSchema: clarityInsightsSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const insights = await clarityService.fetchInsights(args);

				const topPagesReport = insights.topPages
					.map((p, i) => `${i + 1}. ${p.url} — ${p.sessions} sessão(ões)`)
					.join('\n');
				const rageByPageReport = insights.rageClicksByPage
					.map((p, i) => `${i + 1}. ${p.url} — ${p.count} rage click(s)`)
					.join('\n');
				const deadByPageReport = insights.deadClicksByPage
					.map((p, i) => `${i + 1}. ${p.url} — ${p.count} dead click(s)`)
					.join('\n');
				const scriptByPageReport = insights.scriptErrorsByPage
					.map((p, i) => `${i + 1}. ${p.url} — ${p.count} erro(s) de script`)
					.join('\n');
				const deviceReport = insights.sessionsByDevice
					.map((d) => `${d.device}: ${d.count} sessão(ões)`)
					.join(', ');
				const browserReport = insights.sessionsByBrowser
					.map((b) => `${b.browser}: ${b.count} sessão(ões)`)
					.join(', ');

				const report =
					`Insights do Clarity (últimos ${args.numOfDays} dia(s)):\n` +
					`- Sessões: ${insights.totalSessions}\n` +
					`- Sessões de baixo engajamento (estimativa, não é dado oficial do Clarity): ${insights.lowEngagementSessions}\n` +
					`- Rage clicks (cliques contínuos): ${insights.rageClicks} (${insights.rageClickPercent}% das sessões)\n` +
					`- Dead clicks (cliques mortos): ${insights.deadClicks} (${insights.deadClickPercent}% das sessões)\n` +
					`- Erros de script: ${insights.scriptErrors} (${insights.scriptErrorPercent}% das sessões)\n` +
					`- Rolagem excessiva: ${insights.excessiveScrollSessions} (${insights.excessiveScrollPercent}% das sessões)\n` +
					`- Retornos rápidos: ${insights.quickBackSessions} (${insights.quickBackPercent}% das sessões)\n\n` +
					`Páginas mais visitadas:\n${topPagesReport || 'Nenhuma página encontrada.'}\n\n` +
					`Rage clicks por página:\n${rageByPageReport || 'Nenhum rage click encontrado.'}\n\n` +
					`Dead clicks por página:\n${deadByPageReport || 'Nenhum dead click encontrado.'}\n\n` +
					`Erros de script por página:\n${scriptByPageReport || 'Nenhum erro de script encontrado.'}\n\n` +
					`Sessões por dispositivo: ${deviceReport || 'sem dados'}\n` +
					`Sessões por navegador: ${browserReport || 'sem dados'}`;

				return { content: [{ type: 'text', text: report }], structuredContent: insights };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
