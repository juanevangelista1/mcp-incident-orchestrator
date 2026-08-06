import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { queryDatadogErrorIssuesInputSchema, fetchErrorIssuesOutputSchema } from '../datadog.schema.js';
import { DatadogService } from '../datadog.service.js';

// Plugin: Error Tracking do Datadog — diferente do fetch_datadog_logs (que lê /api/v2/logs).
// Existe porque nem toda conta tem Logs configurado (precisa de um log source explícito no
// onboarding do Datadog), mas erros de APM/RUM já aparecem em Error Tracking sem setup extra.
export function registerFetchDatadogErrorIssuesTool(server: McpServer, datadogService: DatadogService): void {
	server.registerTool(
		'fetch_datadog_error_issues',
		{
			description:
				'Busca as issues mais frequentes no Datadog Error Tracking (erros agrupados de APM/RUM/backend), ordenadas por volume de ocorrências.',
			inputSchema: queryDatadogErrorIssuesInputSchema.shape,
			outputSchema: fetchErrorIssuesOutputSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const issues = await datadogService.searchErrorIssues(args);
				if (issues.length === 0) {
					return {
						content: [{ type: 'text', text: 'Nenhuma issue encontrada para esse filtro.' }],
						structuredContent: { issues: [] },
					};
				}

				const report = issues
					.map((i) => `[ID: ${i.id}] (${i.totalCount}x) ${i.service}: ${i.errorType} — ${i.errorMessage}`)
					.join('\n');

				return {
					content: [{ type: 'text', text: `Encontrei ${issues.length} issue(s):\n\n${report}` }],
					structuredContent: { issues },
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
