import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { countIssuesInputSchema } from '../sentry.schema.js';
import { SentryService } from '../sentry.service.js';

// Plugin: Quantidade de Erros — resposta rápida de "quantos" sem baixar o conteúdo de cada erro.
// Útil para a IA decidir a gravidade de um incidente antes de gastar tokens lendo detalhes.
export function registerCountErrorsTool(server: McpServer, sentryService: SentryService): void {
	server.tool(
		'count_sentry_issues',
		'Retorna apenas a quantidade de erros não resolvidos de um projeto no Sentry, sem baixar os detalhes de cada um.',
		countIssuesInputSchema.shape,
		async ({ projectSlug, environment }) => {
			try {
				const total = await sentryService.countIssues(projectSlug, environment);
				const envLabel = environment ? ` no ambiente ${environment}` : ' em todos os ambientes';
				return {
					content: [
						{
							type: 'text',
							text: `O projeto ${projectSlug} tem ${total} erro(s) não resolvido(s)${envLabel}.`,
						},
					],
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
