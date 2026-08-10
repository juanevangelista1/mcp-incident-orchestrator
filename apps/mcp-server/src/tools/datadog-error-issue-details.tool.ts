import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDatadogErrorIssueDetailsInputSchema, datadogErrorIssueDetailsSchema } from '../datadog.schema.js';
import { DatadogService } from '../datadog.service.js';

// Plugin: Detalhes de uma issue do Error Tracking — mesmo papel do get_datadog_log_details
// que existia para Logs (sob demanda, ao clicar num item da lista de fetch_datadog_error_issues).
export function registerDatadogErrorIssueDetailsTool(server: McpServer, datadogService: DatadogService): void {
	server.registerTool(
		'get_datadog_error_issue_details',
		{
			description: 'Busca o contexto completo de uma issue específica do Datadog Error Tracking (arquivo/função de origem, linguagens, versões, regressão).',
			inputSchema: getDatadogErrorIssueDetailsInputSchema.shape,
			outputSchema: datadogErrorIssueDetailsSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const details = await datadogService.getErrorIssueDetails(args.issueId);
				const report =
					`${details.errorType}: ${details.errorMessage}\n` +
					`Serviço: ${details.service} · Estado: ${details.state} · Plataforma: ${details.platform}\n` +
					(details.filePath ? `Arquivo: ${details.filePath}${details.functionName ? ` (${details.functionName})` : ''}\n` : '') +
					`Primeira vez: ${details.firstSeen} · Última vez: ${details.lastSeen}`;

				return { content: [{ type: 'text', text: report }], structuredContent: details };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
