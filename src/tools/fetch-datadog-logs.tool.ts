import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { queryDatadogLogsInputSchema } from '../datadog.schema.js';
import { DatadogService } from '../datadog.service.js';

// Plugin: Captura de Logs — a "lupa da infraestrutura".
// Complementa os plugins do Sentry: enquanto o Sentry mostra a exceção no código,
// o Datadog mostra o que a infraestrutura (serviço, host, status) estava fazendo no mesmo instante.
export function registerFetchDatadogLogsTool(server: McpServer, datadogService: DatadogService): void {
	server.tool(
		'fetch_datadog_logs',
		'Busca os logs mais recentes no Datadog, filtrando por serviço, ambiente e/ou texto livre.',
		queryDatadogLogsInputSchema.shape,
		async (args) => {
			try {
				const logs = await datadogService.queryLogs(args);
				if (logs.length === 0) {
					return { content: [{ type: 'text', text: 'Nenhum log encontrado para esse filtro.' }] };
				}

				const report = logs
					.map((l) => `[ID: ${l.id}] [${l.timestamp}] (${l.status}) ${l.service}: ${l.message}`)
					.join('\n');

				return { content: [{ type: 'text', text: `Encontrei ${logs.length} log(s):\n\n${report}` }] };
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
