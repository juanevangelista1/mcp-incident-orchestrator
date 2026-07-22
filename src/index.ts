import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SentryService } from './sentry.service.js';
import { registerCaptureErrorsTool } from './tools/capture-errors.tool.js';
import { registerCountErrorsTool } from './tools/count-errors.tool.js';
import { registerSummarizeErrorsTool } from './tools/summarize-errors.tool.js';
import { registerErrorDetailsTool } from './tools/error-details.tool.js';

// 1. Injeção de Dependências
const sentryService = new SentryService();

// 2. Instanciando o Servidor MCP
const server = new McpServer({
	name: 'l3-incident-orchestrator',
	version: '1.0.0',
});

// 3. Plugando cada capacidade (plugin) no servidor.
// Para adicionar uma nova capacidade no futuro (ex: Datadog), basta criar um novo arquivo
// em src/tools/ e registrar aqui — nenhum destes 4 plugins precisa mudar (Open/Closed Principle).
registerCaptureErrorsTool(server, sentryService);
registerCountErrorsTool(server, sentryService);
registerSummarizeErrorsTool(server, sentryService);
registerErrorDetailsTool(server, sentryService);

// 4. Adaptador de Transporte (Stdio)
async function run() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Servidor MCP Incident Orchestrator rodando. Aguardando conexões via stdio...');
}

run().catch(console.error);
