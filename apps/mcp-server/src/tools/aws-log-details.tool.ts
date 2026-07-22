import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAwsLogDetailsInputSchema, awsLogDetailsSchema } from '../aws-cloudwatch.schema.js';
import { AwsCloudWatchService } from '../aws-cloudwatch.service.js';

// Plugin: Detalhes do Evento (AWS) — sob demanda, quando a IA já escolheu um eventId
// específico e precisa do contexto ao redor (linhas antes/depois) para diagnosticar.
export function registerAwsLogDetailsTool(server: McpServer, awsService: AwsCloudWatchService): void {
	server.registerTool(
		'get_aws_log_details',
		{
			description: 'Busca o contexto completo (linhas antes/depois) de um evento específico do CloudWatch Logs.',
			inputSchema: getAwsLogDetailsInputSchema.shape,
			outputSchema: awsLogDetailsSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async ({ eventId }) => {
			try {
				const details = await awsService.getEventDetails(eventId);
				const report =
					`Evento: ${details.message}\n\n` +
					`Log Stream: ${details.logStreamName} | Timestamp: ${details.timestamp}\n\n` +
					`CONTEXTO ANTERIOR:\n${details.tags.contextBefore}\n\n` +
					`CONTEXTO POSTERIOR:\n${details.tags.contextAfter}`;
				return { content: [{ type: 'text', text: report }], structuredContent: details };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
