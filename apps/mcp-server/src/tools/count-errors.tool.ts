import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { countIssuesInputSchema, countIssuesOutputSchema } from '../sentry.schema.js';
import { SentryService } from '../sentry.service.js';

// Plugin: Quantidade de Erros — resposta rápida de "quantos" sem baixar o conteúdo de cada erro.
// Útil para a IA decidir a gravidade de um incidente antes de gastar tokens lendo detalhes.
export function registerCountErrorsTool(server: McpServer, sentryService: SentryService): void {
	server.registerTool(
		'count_sentry_issues',
		{
			description:
				'Retorna apenas a quantidade de erros não resolvidos de um projeto no Sentry, sem baixar os detalhes de cada um.',
			inputSchema: countIssuesInputSchema.shape,
			outputSchema: countIssuesOutputSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const { projectSlug, environment, route } = args;
				const total = await sentryService.countIssues(projectSlug, args);
				const envLabel = environment ? ` no ambiente ${environment}` : ' em todos os ambientes';
				const routeLabel = route ? ` na rota '${route}'` : '';
				return {
					content: [
						{
							type: 'text',
							text: `O projeto ${projectSlug} tem ${total} erro(s) não resolvido(s)${envLabel}${routeLabel}.`,
						},
					],
					structuredContent: { total },
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
