import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServices, buildMcpServer } from './server-factory.js';

const PORT = Number(process.env.MCP_HTTP_PORT) || 3333;

// Services (e seus caches) são criados uma única vez para o processo inteiro.
// Só o McpServer + transport são recriados a cada requisição — modo stateless
// recomendado pelo SDK para não vazar estado entre chamadas de clientes diferentes
// (o dashboard, o Cursor, etc. podem chamar concorrentemente sem se atrapalhar).
const services = createServices();

async function readBody(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	const raw = Buffer.concat(chunks).toString('utf8');
	return raw ? JSON.parse(raw) : undefined;
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const server = buildMcpServer(services);
	const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

	res.on('close', () => {
		transport.close();
		server.close();
	});

	await server.connect(transport);

	const parsedBody = req.method === 'POST' ? await readBody(req) : undefined;
	await transport.handleRequest(req, res, parsedBody);
}

const httpServer = createServer((req, res) => {
	if (req.url !== '/mcp') {
		res.writeHead(404).end('Not found');
		return;
	}

	handleMcpRequest(req, res).catch((error) => {
		console.error('[HTTP] Falha ao processar requisição MCP:', error);
		if (!res.headersSent) {
			res.writeHead(500, { 'Content-Type': 'application/json' });
		}
		res.end(JSON.stringify({ error: 'Erro interno do servidor MCP' }));
	});
});

httpServer.listen(PORT, () => {
	console.error(`Servidor MCP Incident Orchestrator (HTTP) rodando em http://localhost:${PORT}/mcp`);
});
