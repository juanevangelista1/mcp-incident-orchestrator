import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { summarizeIssuesInputSchema } from '../sentry.schema.js';
import { SentryService } from '../sentry.service.js';

// Plugin: Resumo dos Erros — o "relatório do médico-chefe": não lista tudo, entrega o panorama.
// Agrega os dados que já vieram da captura (sem nova chamada de rede) em um formato pronto para leitura humana/IA.
export function registerSummarizeErrorsTool(server: McpServer, sentryService: SentryService): void {
	server.tool(
		'summarize_sentry_issues',
		'Gera um resumo executivo dos erros não resolvidos de um projeto: total de erros, total de ocorrências e os erros mais frequentes.',
		summarizeIssuesInputSchema.shape,
		async ({ projectSlug, environment, route }) => {
			try {
				const summary = await sentryService.summarizeIssues(projectSlug, environment, route);

				const topCulpritsReport = summary.topCulprits
					.map((c, index) => `${index + 1}. ${c.culprit} — ${c.count} ocorrências`)
					.join('\n');

				const report =
					`Resumo do projeto ${projectSlug}:\n` +
					`- Total de erros distintos: ${summary.totalIssues}\n` +
					`- Total de ocorrências somadas: ${summary.totalOccurrences}\n\n` +
					`Erros mais frequentes:\n${topCulpritsReport || 'Nenhum erro encontrado.'}`;

				return { content: [{ type: 'text', text: report }] };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
