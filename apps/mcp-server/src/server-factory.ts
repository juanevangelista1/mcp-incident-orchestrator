import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SentryService } from './sentry.service.js';
import { DatadogService } from './datadog.service.js';
import { ClarityService } from './clarity.service.js';
import { AwsCloudWatchService } from './aws-cloudwatch.service.js';
import { registerCaptureErrorsTool } from './tools/capture-errors.tool.js';
import { registerCountErrorsTool } from './tools/count-errors.tool.js';
import { registerSummarizeErrorsTool } from './tools/summarize-errors.tool.js';
import { registerErrorDetailsTool } from './tools/error-details.tool.js';
import { registerFetchDatadogLogsTool } from './tools/fetch-datadog-logs.tool.js';
import { registerCountDatadogLogsTool } from './tools/count-datadog-logs.tool.js';
import { registerSummarizeDatadogLogsTool } from './tools/summarize-datadog-logs.tool.js';
import { registerDatadogLogDetailsTool } from './tools/datadog-log-details.tool.js';
import { registerFetchClarityInsightsTool } from './tools/fetch-clarity-insights.tool.js';
import { registerFetchClarityRegionInsightsTool } from './tools/fetch-clarity-region-insights.tool.js';
import { registerFetchAwsLogsTool } from './tools/fetch-aws-logs.tool.js';
import { registerCountAwsLogsTool } from './tools/count-aws-logs.tool.js';
import { registerSummarizeAwsLogsTool } from './tools/summarize-aws-logs.tool.js';
import { registerAwsLogDetailsTool } from './tools/aws-log-details.tool.js';

export interface OrchestratorServices {
	sentry: SentryService;
	datadog?: DatadogService;
	clarity?: ClarityService;
	aws?: AwsCloudWatchService;
}

// Os services guardam os caches (rate-limit protection) e devem viver por todo o processo,
// não ser recriados a cada requisição — só o McpServer (abaixo) é barato o bastante pra isso.
export function createServices(): OrchestratorServices {
	// O Sentry é fail-fast: sem credenciais, o processo nem sobe (é o core do MVP).
	const sentry = new SentryService();

	let datadog: DatadogService | undefined;
	try {
		datadog = new DatadogService();
	} catch (error: any) {
		console.error(`[Datadog] Plugin opcional não configurado (${error.message}) — tools do Datadog ficam de fora.`);
	}

	let clarity: ClarityService | undefined;
	try {
		clarity = new ClarityService();
	} catch (error: any) {
		console.error(`[Clarity] Plugin opcional não configurado (${error.message}) — tools do Clarity ficam de fora.`);
	}

	let aws: AwsCloudWatchService | undefined;
	try {
		aws = new AwsCloudWatchService();
	} catch (error: any) {
		console.error(`[AWS] Plugin opcional não configurado (${error.message}) — tools do CloudWatch ficam de fora.`);
	}

	return { sentry, datadog, clarity, aws };
}

// Monta um McpServer novo plugando as tools sobre os services recebidos.
// Barato de chamar várias vezes: não recria services, só registra handlers.
export function buildMcpServer(services: OrchestratorServices): McpServer {
	const server = new McpServer({
		name: 'l3-incident-orchestrator',
		version: '1.0.0',
	});

	registerCaptureErrorsTool(server, services.sentry);
	registerCountErrorsTool(server, services.sentry);
	registerSummarizeErrorsTool(server, services.sentry);
	registerErrorDetailsTool(server, services.sentry);

	if (services.datadog) {
		registerFetchDatadogLogsTool(server, services.datadog);
		registerCountDatadogLogsTool(server, services.datadog);
		registerSummarizeDatadogLogsTool(server, services.datadog);
		registerDatadogLogDetailsTool(server, services.datadog);
	}

	if (services.clarity) {
		registerFetchClarityInsightsTool(server, services.clarity);
		registerFetchClarityRegionInsightsTool(server, services.clarity);
	}

	if (services.aws) {
		registerFetchAwsLogsTool(server, services.aws);
		registerCountAwsLogsTool(server, services.aws);
		registerSummarizeAwsLogsTool(server, services.aws);
		registerAwsLogDetailsTool(server, services.aws);
	}

	return server;
}
