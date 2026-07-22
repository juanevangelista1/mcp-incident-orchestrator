import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { summarizeAwsLogsInputSchema, awsLogsSummarySchema } from '../aws-cloudwatch.schema.js';
import { AwsCloudWatchService } from '../aws-cloudwatch.service.js';

// Plugin: Resumo dos Eventos (AWS) — panorama agregado (total, por log stream),
// reaproveitando a mesma busca da captura em vez de bater na API de novo.
export function registerSummarizeAwsLogsTool(server: McpServer, awsService: AwsCloudWatchService): void {
	server.registerTool(
		'summarize_aws_logs',
		{
			description: 'Gera um resumo dos eventos recentes do CloudWatch Logs: total e quebra por log stream.',
			inputSchema: summarizeAwsLogsInputSchema.shape,
			outputSchema: awsLogsSummarySchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const summary = await awsService.summarizeEvents(args);

				const byStreamReport = summary.byLogStream
					.map((s, i) => `${i + 1}. ${s.logStreamName} — ${s.count} evento(s)`)
					.join('\n');

				const report =
					`Resumo dos eventos do CloudWatch (últimos ${args.minutesAgo} min):\n` +
					`- Total: ${summary.totalEvents}\n\n` +
					`Streams mais frequentes:\n${byStreamReport || 'Nenhum evento encontrado.'}`;

				return { content: [{ type: 'text', text: report }], structuredContent: summary };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
