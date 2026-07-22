import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchIssuesInputSchema } from '../sentry.schema.js';
import { SentryService } from '../sentry.service.js';

// Plugin: Captura de Erros — a "enfermeira da triagem".
// Devolve uma lista enxuta dos erros não resolvidos, sem stack trace, para a IA decidir o que investigar a fundo.
export function registerCaptureErrorsTool(server: McpServer, sentryService: SentryService): void {
	server.tool(
		'fetch_sentry_issues',
		'Busca os erros não resolvidos mais recentes de um projeto no Sentry.',
		fetchIssuesInputSchema.shape,
		async (args) => {
			try {
				const issues = await sentryService.fetchRecentIssues(
					args.projectSlug,
					args.environment,
					args.limit,
					args.route,
				);
				const report = issues
					.map((i) => `[ID: ${i.id}] ${i.title} (Ocorrências: ${i.count})`)
					.join('\n');
				return {
					content: [{ type: 'text', text: `Encontrei ${issues.length} erro(s):\n\n${report}` }],
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
