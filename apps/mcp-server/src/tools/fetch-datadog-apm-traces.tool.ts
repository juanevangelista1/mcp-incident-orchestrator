import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { queryDatadogApmTracesInputSchema, fetchApmTracesOutputSchema } from '../datadog.schema.js';
import { DatadogService } from '../datadog.service.js';

// Plugin: APM Traces com erro — granularidade de chamada individual (serviço → serviço,
// HTTP, duração), diferente do Error Tracking (que agrupa erros em issues "de negócio").
// Útil pra ver o request específico por trás de um pico de erros.
export function registerFetchDatadogApmTracesTool(server: McpServer, datadogService: DatadogService): void {
	server.registerTool(
		'fetch_datadog_apm_traces',
		{
			description:
				'Busca os spans de APM com erro (status:error) mais recentes no Datadog, filtrando por serviço/ambiente/texto livre.',
			inputSchema: queryDatadogApmTracesInputSchema.shape,
			outputSchema: fetchApmTracesOutputSchema.shape,
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		},
		async (args) => {
			try {
				const traces = await datadogService.searchErrorTraces(args);
				if (traces.length === 0) {
					return {
						content: [{ type: 'text', text: 'Nenhum span de erro encontrado para esse filtro.' }],
						structuredContent: { traces: [] },
					};
				}

				const report = traces
					.map(
						(t) =>
							`[trace: ${t.traceId}] ${t.service}: ${t.operationName} (${t.resourceName})` +
							(t.httpStatusCode ? ` — HTTP ${t.httpMethod} ${t.httpStatusCode}` : '') +
							` — ${t.durationMs}ms`,
					)
					.join('\n');

				return {
					content: [{ type: 'text', text: `Encontrei ${traces.length} span(s) de erro:\n\n${report}` }],
					structuredContent: { traces },
				};
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
			}
		},
	);
}
