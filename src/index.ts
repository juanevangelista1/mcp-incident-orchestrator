import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fetchIssuesInputSchema, fetchIssueDetailsInputSchema } from './sentry.schema.js';
import { SentryService } from './sentry.service.js';

// 1. Injeção de Dependências
const sentryService = new SentryService();

// 2. Instanciando o Servidor MCP
const server = new McpServer({
	name: 'l3-incident-orchestrator',
	version: '1.0.0',
});

// 3. Registrando a Tool 1: A Lupa de Visão Geral (Lista de Erros)
server.tool(
	'fetch_sentry_issues',
	'Busca os erros não resolvidos mais recentes de um projeto no Sentry.',
	fetchIssuesInputSchema.shape,
	async (args) => {
		try {
			const issues = await sentryService.fetchRecentIssues(
				args.projectSlug,
				args.environment,
				args.limit,
			);
			const report = issues
				.map((i) => `[ID: ${i.id}] ${i.title} (Ocorrências: ${i.count})`)
				.join('\n');
			return { content: [{ type: 'text', text: `Encontrei ${issues.length} erro(s):\n\n${report}` }] };
		} catch (error: any) {
			return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
		}
	},
);

// 4. Registrando a Tool 2: O Raio-X (Detalhes do Erro com Stack Trace)
server.tool(
	'get_sentry_issue_details',
	'Busca a Stack Trace detalhada de um erro específico através do seu ID.',
	fetchIssueDetailsInputSchema.shape,
	async ({ issueId }) => {
		try {
			const details = await sentryService.fetchIssueDetails(issueId);
			const report = `Erro: ${details.errorMessage}\n\nSTACK TRACE:\n${details.stackTrace.join('\n')}`;
			return { content: [{ type: 'text', text: report }] };
		} catch (error: any) {
			return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
		}
	},
);

// 5. Adaptador de Transporte (Stdio)
async function run() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Servidor MCP Incident Orchestrator rodando. Aguardando conexões via stdio...');
}

run().catch(console.error);

// project slug = javascript-nextjs

// SENTRY_AUTH_TOKEN="***REMOVED-SENTRY-TOKEN***" SENTRY_ORG_SLUG="juanevangelista" npx @modelcontextprotocol/inspector npx tsx src/index.ts
