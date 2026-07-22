import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { summarizeDatadogLogsInputSchema, datadogLogsSummarySchema } from '../datadog.schema.js';
import { DatadogService } from '../datadog.service.js';

// Plugin: Resumo dos Logs — panorama agregado (total, por status, por serviço),
// reaproveitando a mesma busca da captura em vez de bater na API de novo.
export function registerSummarizeDatadogLogsTool(server: McpServer, datadogService: DatadogService): void {
	server.registerTool(
		'summarize_datadog_logs',
		{
			description: 'Gera um resumo dos logs recentes: total, quebra por status (error/warn/info) e por serviço.',
			inputSchema: summarizeDatadogLogsInputSchema.shape,
			outputSchema: datadogLogsSummarySchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const summary = await datadogService.summarizeLogs(args);

				const byStatusReport = summary.byStatus.map((s) => `${s.status}: ${s.count}`).join(', ');
				const byServiceReport = summary.byService
					.map((s, i) => `${i + 1}. ${s.service} — ${s.count} log(s)`)
					.join('\n');

				const report =
					`Resumo dos logs (últimos ${args.minutesAgo} min):\n` +
					`- Total: ${summary.totalLogs}\n` +
					`- Por status: ${byStatusReport || 'nenhum'}\n\n` +
					`Serviços mais frequentes:\n${byServiceReport || 'Nenhum log encontrado.'}`;

				return { content: [{ type: 'text', text: report }], structuredContent: summary };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
