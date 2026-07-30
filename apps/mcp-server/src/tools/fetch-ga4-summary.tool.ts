import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchGa4SummaryInputSchema, ga4SummarySchema } from '../ga4.schema.js';
import { Ga4Service } from '../ga4.service.js';

// Plugin: resumo do Google Analytics 4 — traz o que falta desde a Fase 3, um evento de
// conversão REAL (não um proxy como as sessões do Clarity chegando na URL de agendamento).
export function registerFetchGa4SummaryTool(server: McpServer, ga4Service: Ga4Service): void {
	server.registerTool(
		'fetch_ga4_summary',
		{
			description:
				'Busca um resumo do Google Analytics 4: sessões, usuários, conversões de um evento específico (se configurado) e páginas/dispositivos mais usados, numa janela de dias.',
			inputSchema: fetchGa4SummaryInputSchema.shape,
			outputSchema: ga4SummarySchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const summary = await ga4Service.fetchSummary(args);

				const pagesReport = summary.topPagesBySessions
					.map((p, i) => `${i + 1}. ${p.page} — ${p.sessions} sessão(ões)`)
					.join('\n');
				const deviceReport = summary.sessionsByDevice.map((d) => `${d.device}: ${d.sessions} sessão(ões)`).join(', ');
				const conversionLine = summary.conversionEventName
					? `- Conversões (evento '${summary.conversionEventName}'): ${summary.conversions}`
					: "- Conversões: não configurado (defina GA4_CONVERSION_EVENT_NAME com o nome do evento real de conversão)";

				const report =
					`Resumo do GA4 (últimos ${args.numOfDays} dia(s)):\n` +
					`- Sessões: ${summary.sessions}\n` +
					`- Usuários: ${summary.totalUsers}\n` +
					`${conversionLine}\n\n` +
					`Páginas mais visitadas:\n${pagesReport || 'Nenhuma página encontrada.'}\n\n` +
					`Sessões por dispositivo: ${deviceReport || 'sem dados'}`;

				return { content: [{ type: 'text', text: report }], structuredContent: summary };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
