import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { dynamicTool, jsonSchema, ToolSet } from 'ai';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:3333/mcp';

// O Gemini pode chamar essas tools com qualquer combinação de numOfDays/url/device que
// "decidir" — cada combinação nova é uma cota gasta na API do Clarity (limite: 10/dia), e o
// chat já contribuiu pra estourar essa cota mais de uma vez sem nenhum controle sobre o
// padrão de chamada. Insights do Clarity ficam de fora do chat; `/insights` e `/reports` já
// respondem isso com opções fixas (ver FilterForm em insights/page.tsx).
const EXCLUDED_FROM_CHAT = new Set(['fetch_clarity_insights', 'fetch_clarity_region_insights']);

// Ponte MCP -> AI SDK: descobre as tools do nosso servidor em tempo de execução
// (tools/list) e expõe cada uma como uma `dynamicTool` que o Gemini pode chamar.
// Isso evita reimplementar cada tool como function-calling manual — o mesmo
// servidor que serve o Cursor/Inspector serve o chat, sem duplicar lógica.
export async function loadMcpTools(): Promise<{ tools: ToolSet; close: () => Promise<void> }> {
	const client = new Client({ name: 'l3-dashboard-chat', version: '1.0.0' });
	const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));
	await client.connect(transport);

	const { tools: mcpTools } = await client.listTools();

	const tools: ToolSet = {};
	for (const mcpTool of mcpTools) {
		if (EXCLUDED_FROM_CHAT.has(mcpTool.name)) continue;
		tools[mcpTool.name] = dynamicTool({
			description: mcpTool.description,
			inputSchema: jsonSchema(mcpTool.inputSchema as any),
			execute: async (input) => {
				const result = await client.callTool({ name: mcpTool.name, arguments: input as Record<string, unknown> });
				const content = result.content as Array<{ type: string; text?: string }> | undefined;
				const textPart = content?.find((c) => c.type === 'text');
				if (result.isError) {
					throw new Error(textPart?.text ?? `Falha ao chamar a tool '${mcpTool.name}'.`);
				}
				return textPart?.text ?? JSON.stringify(result.structuredContent ?? {});
			},
		});
	}

	return { tools, close: () => client.close() };
}
