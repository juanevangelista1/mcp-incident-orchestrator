import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDatadogLogDetailsInputSchema, datadogLogDetailsSchema } from '../datadog.schema.js';
import { DatadogService } from '../datadog.service.js';

// Plugin: Detalhes do Log — sob demanda, quando a IA já escolheu um logId específico
// (via captura ou resumo) e precisa das tags completas para diagnosticar.
export function registerDatadogLogDetailsTool(server: McpServer, datadogService: DatadogService): void {
	server.registerTool(
		'get_datadog_log_details',
		{
			description: 'Busca todas as tags e detalhes completos de um log específico através do seu ID.',
			inputSchema: getDatadogLogDetailsInputSchema.shape,
			outputSchema: datadogLogDetailsSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ logId }) => {
			try {
				const details = await datadogService.getLogDetails(logId);
				const report =
					`Log: ${details.message}\n\n` +
					`Serviço: ${details.service} | Status: ${details.status} | Host: ${details.host}\n\n` +
					`TAGS:\n${JSON.stringify(details.tags, null, 2)}`;
				return { content: [{ type: 'text', text: report }], structuredContent: details };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
