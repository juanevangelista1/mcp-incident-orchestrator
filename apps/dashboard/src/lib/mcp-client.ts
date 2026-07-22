import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:3333/mcp';

export interface McpToolResult<T> {
	text: string;
	data: T | undefined;
}

// Uma conexão nova por chamada: simples e segura para o modelo de request do Next.js
// (cada Server Component/Route Handler roda de forma independente). O overhead de um
// handshake extra por chamada é aceitável para o volume de um dashboard interno.
export async function callMcpTool<T = Record<string, unknown>>(
	name: string,
	args: Record<string, unknown> = {},
): Promise<McpToolResult<T>> {
	const client = new Client({ name: 'l3-dashboard', version: '1.0.0' });
	const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));

	try {
		await client.connect(transport);
		const result = await client.callTool({ name, arguments: args });

		const content = result.content as Array<{ type: string; text?: string }> | undefined;
		const textPart = content?.find((c) => c.type === 'text');

		if (result.isError) {
			throw new Error(textPart?.text ?? `Falha ao chamar a tool '${name}'.`);
		}

		return {
			text: textPart?.text ?? '',
			data: result.structuredContent as T | undefined,
		};
	} finally {
		await client.close();
	}
}
