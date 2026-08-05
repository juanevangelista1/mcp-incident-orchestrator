import 'dotenv/config';
import './tracer.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServices, buildMcpServer } from './server-factory.js';

async function run() {
	const services = createServices();
	const server = buildMcpServer(services);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Servidor MCP Orquestrador de Incidentes rodando. Aguardando conexões via stdio...');
}

run().catch(console.error);
