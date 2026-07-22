import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchAwsLogsInputSchema, fetchAwsLogsOutputSchema } from '../aws-cloudwatch.schema.js';
import { AwsCloudWatchService } from '../aws-cloudwatch.service.js';

// Plugin: Captura de Logs (AWS) — mesmo papel do fetch_datadog_logs, mas para
// CloudWatch Logs (Lambda, ECS, EC2 etc).
export function registerFetchAwsLogsTool(server: McpServer, awsService: AwsCloudWatchService): void {
	server.registerTool(
		'fetch_aws_logs',
		{
			description: 'Busca os eventos mais recentes no CloudWatch Logs, filtrando por log group e/ou filter pattern.',
			inputSchema: fetchAwsLogsInputSchema.shape,
			outputSchema: fetchAwsLogsOutputSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const logs = await awsService.queryEvents(args);
				if (logs.length === 0) {
					return {
						content: [{ type: 'text', text: 'Nenhum evento encontrado para esse filtro.' }],
						structuredContent: { logs: [] },
					};
				}

				const report = logs
					.map((l) => `[ID: ${l.id}] [${l.timestamp}] (${l.logStreamName}) ${l.message}`)
					.join('\n');

				return {
					content: [{ type: 'text', text: `Encontrei ${logs.length} evento(s):\n\n${report}` }],
					structuredContent: { logs },
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
