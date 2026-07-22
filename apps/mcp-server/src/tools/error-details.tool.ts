import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchIssueDetailsInputSchema, sentryIssueDetailsSchema } from '../sentry.schema.js';
import { SentryService } from '../sentry.service.js';

// Plugin: Detalhes do Erro — o "raio-X". Só é chamado sob demanda, quando a IA já escolheu
// um issueId específico (via captura ou resumo) e precisa da stack trace completa para diagnosticar.
export function registerErrorDetailsTool(server: McpServer, sentryService: SentryService): void {
	server.registerTool(
		'get_sentry_issue_details',
		{
			description: 'Busca a Stack Trace detalhada de um erro específico através do seu ID.',
			inputSchema: fetchIssueDetailsInputSchema.shape,
			outputSchema: sentryIssueDetailsSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ issueId }) => {
			try {
				const details = await sentryService.fetchIssueDetails(issueId);
				const report = `Erro: ${details.errorMessage}\n\nSTACK TRACE:\n${details.stackTrace.join('\n')}`;
				return { content: [{ type: 'text', text: report }], structuredContent: details };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
