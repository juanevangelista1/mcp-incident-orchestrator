import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { countDatadogLogsInputSchema } from '../datadog.schema.js';
import { DatadogService } from '../datadog.service.js';

// Plugin: Quantidade de Logs — resposta rápida de "quantos" via endpoint de agregação,
// sem baixar o corpo de cada log.
export function registerCountDatadogLogsTool(server: McpServer, datadogService: DatadogService): void {
	server.tool(
		'count_datadog_logs',
		'Retorna apenas a quantidade de logs que casam com o filtro, sem baixar o conteúdo de cada um.',
		countDatadogLogsInputSchema.shape,
		async (args) => {
			try {
				const total = await datadogService.countLogs(args);
				return {
					content: [
						{ type: 'text', text: `Encontrei ${total} log(s) nos últimos ${args.minutesAgo} minuto(s).` },
					],
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
