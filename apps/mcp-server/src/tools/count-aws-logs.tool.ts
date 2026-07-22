import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { countAwsLogsInputSchema, countAwsLogsOutputSchema } from '../aws-cloudwatch.schema.js';
import { AwsCloudWatchService } from '../aws-cloudwatch.service.js';

// Plugin: Quantidade de Eventos (AWS) — pagina o CloudWatch Logs por baixo dos panos,
// já que não existe um endpoint de agregação como no Datadog.
export function registerCountAwsLogsTool(server: McpServer, awsService: AwsCloudWatchService): void {
	server.registerTool(
		'count_aws_logs',
		{
			description: 'Retorna apenas a quantidade de eventos do CloudWatch Logs que casam com o filtro.',
			inputSchema: countAwsLogsInputSchema.shape,
			outputSchema: countAwsLogsOutputSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const total = await awsService.countEvents(args);
				return {
					content: [
						{ type: 'text', text: `Encontrei ${total} evento(s) nos últimos ${args.minutesAgo} minuto(s).` },
					],
					structuredContent: { total },
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
