import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchIssueDetailsInputSchema } from '../sentry.schema.js';
import { SentryService } from '../sentry.service.js';

// Plugin: Detalhes do Erro — o "raio-X". Só é chamado sob demanda, quando a IA já escolheu
// um issueId específico (via captura ou resumo) e precisa da stack trace completa para diagnosticar.
export function registerErrorDetailsTool(server: McpServer, sentryService: SentryService): void {
	server.tool(
		'get_sentry_issue_details',
		'Busca a Stack Trace detalhada de um erro específico através do seu ID.',
		fetchIssueDetailsInputSchema.shape,
		async ({ issueId }) => {
			try {
				const details = await sentryService.fetchIssueDetails(issueId);
				const report = `Erro: ${details.errorMessage}\n\nSTACK TRACE:\n${details.stackTrace.join('\n')}`;
				return { content: [{ type: 'text', text: report }] };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
