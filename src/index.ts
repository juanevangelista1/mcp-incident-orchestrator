import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SentryService } from './sentry.service.js';
import { DatadogService } from './datadog.service.js';
import { ClarityService } from './clarity.service.js';
import { registerCaptureErrorsTool } from './tools/capture-errors.tool.js';
import { registerCountErrorsTool } from './tools/count-errors.tool.js';
import { registerSummarizeErrorsTool } from './tools/summarize-errors.tool.js';
import { registerErrorDetailsTool } from './tools/error-details.tool.js';
import { registerFetchDatadogLogsTool } from './tools/fetch-datadog-logs.tool.js';
import { registerCountDatadogLogsTool } from './tools/count-datadog-logs.tool.js';
import { registerSummarizeDatadogLogsTool } from './tools/summarize-datadog-logs.tool.js';
import { registerDatadogLogDetailsTool } from './tools/datadog-log-details.tool.js';
import { registerFetchClarityInsightsTool } from './tools/fetch-clarity-insights.tool.js';

// 1. Injeção de Dependências
// O Sentry é fail-fast: sem credenciais, o servidor nem sobe (é o core do MVP).
const sentryService = new SentryService();

// 2. Instanciando o Servidor MCP
const server = new McpServer({
	name: 'l3-incident-orchestrator',
	version: '1.0.0',
});

// 3. Plugando cada capacidade (plugin) no servidor.
// Para adicionar uma nova capacidade no futuro, basta criar um novo arquivo
// em src/tools/ e registrar aqui — nenhum plugin já existente precisa mudar (Open/Closed Principle).
registerCaptureErrorsTool(server, sentryService);
registerCountErrorsTool(server, sentryService);
registerSummarizeErrorsTool(server, sentryService);
registerErrorDetailsTool(server, sentryService);

// O Datadog é opcional: se as credenciais não estiverem configuradas ainda,
// só esse plugin fica desligado — o resto do servidor (Sentry) continua funcionando normalmente.
try {
	const datadogService = new DatadogService();
	registerFetchDatadogLogsTool(server, datadogService);
	registerCountDatadogLogsTool(server, datadogService);
	registerSummarizeDatadogLogsTool(server, datadogService);
	registerDatadogLogDetailsTool(server, datadogService);
} catch (error: any) {
	console.error(`[Datadog] Plugins desabilitados: ${error.message}`);
}

// O Clarity segue a mesma regra: opcional, sem derrubar o servidor se não configurado.
try {
	const clarityService = new ClarityService();
	registerFetchClarityInsightsTool(server, clarityService);
} catch (error: any) {
	console.error(`[Clarity] Plugin desabilitado: ${error.message}`);
}

// 4. Adaptador de Transporte (Stdio)
async function run() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Servidor MCP Incident Orchestrator rodando. Aguardando conexões via stdio...');
}

run().catch(console.error);
