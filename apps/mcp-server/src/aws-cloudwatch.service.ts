import { CloudWatchLogsClient, FilterLogEventsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { AwsLogEntry, AwsLogDetails, AwsLogsSummary, awsLogEntrySchema, awsLogDetailsSchema } from './aws-cloudwatch.schema';
import { TtlCache, cacheFilePath } from './lib/ttl-cache';

interface LogQueryParams {
	logGroupName?: string;
	filterPattern?: string;
	minutesAgo: number;
}

// Cada evento do CloudWatch não tem um endpoint "buscar por ID" como Sentry/Datadog —
// só dá pra reler eventos de uma logStream específica. Por isso o "id" que devolvemos
// pra IA é um envelope com tudo que precisamos pra voltar lá depois (ver getLogDetails).
interface EventIdPayload {
	logGroupName: string;
	logStreamName: string;
	eventId: string;
	timestamp: number;
}

// Teto de páginas ao contar eventos: o CloudWatch não tem um endpoint de agregação
// (diferente do Datadog), então contar significa paginar filterLogEvents. Sem teto,
// uma janela de 24h num log group barulhento poderia paginar indefinidamente.
const MAX_COUNT_PAGES = 5;
const PAGE_SIZE = 1000;

export class AwsCloudWatchService {
	private readonly client: CloudWatchLogsClient;
	private readonly defaultLogGroupName?: string;

	private readonly searchCache = new TtlCache<AwsLogEntry[]>(
		30_000,
		500,
		cacheFilePath(__dirname, 'aws-search.json'),
	);
	private readonly detailsCache = new TtlCache<AwsLogDetails>(
		60_000,
		500,
		cacheFilePath(__dirname, 'aws-log-details.json'),
	);

	constructor() {
		const region = process.env.AWS_REGION;
		const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

		if (!region || !accessKeyId || !secretAccessKey) {
			throw new Error(
				'Variáveis de ambiente AWS_REGION, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY são obrigatórias.',
			);
		}

		this.client = new CloudWatchLogsClient({ region, credentials: { accessKeyId, secretAccessKey } });
		this.defaultLogGroupName = process.env.AWS_LOG_GROUP_NAME;
	}

	private resolveLogGroupName(logGroupName?: string): string {
		const resolved = logGroupName || this.defaultLogGroupName;
		if (!resolved) {
			throw new Error(
				"Nenhum logGroupName informado e AWS_LOG_GROUP_NAME não está configurado no servidor.",
			);
		}
		return resolved;
	}

	private encodeEventId(payload: EventIdPayload): string {
		return Buffer.from(JSON.stringify(payload)).toString('base64url');
	}

	private decodeEventId(id: string): EventIdPayload {
		try {
			return JSON.parse(Buffer.from(id, 'base64url').toString('utf-8'));
		} catch {
			throw new Error(`ID de evento inválido: '${id}'.`);
		}
	}

	// Captura: lista os eventos mais recentes que casam com o filtro.
	public async queryEvents(params: LogQueryParams & { limit: number }): Promise<AwsLogEntry[]> {
		const logGroupName = this.resolveLogGroupName(params.logGroupName);
		const cacheKey = JSON.stringify({ ...params, logGroupName });
		const cached = this.searchCache.get(cacheKey);
		if (cached) {
			console.error('[CACHE HIT] Retornando eventos do CloudWatch da memória.');
			return cached;
		}

		console.error('[CACHE MISS] Buscando eventos na API do CloudWatch Logs.');
		const command = new FilterLogEventsCommand({
			logGroupName,
			filterPattern: params.filterPattern,
			startTime: Date.now() - params.minutesAgo * 60_000,
			endTime: Date.now(),
			limit: params.limit,
		});

		const response = await this.client.send(command);

		// Fronteira da Anti-Corruption Layer: validamos contra o schema em vez de confiar
		// cegamente no shape devolvido pelo SDK da AWS.
		const logs = awsLogEntrySchema.array().parse(
			(response.events || []).map((event) => ({
				id: this.encodeEventId({
					logGroupName,
					logStreamName: event.logStreamName ?? 'desconhecido',
					eventId: event.eventId ?? 'desconhecido',
					timestamp: event.timestamp ?? 0,
				}),
				timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : 'desconhecido',
				logStreamName: event.logStreamName ?? 'desconhecido',
				message: (event.message ?? '').trim(),
			})),
		);

		this.searchCache.set(cacheKey, logs);
		return logs;
	}

	// Quantidade de eventos: pagina filterLogEvents somando o total, até MAX_COUNT_PAGES
	// (não existe endpoint de agregação no CloudWatch Logs, diferente do Datadog).
	public async countEvents(params: LogQueryParams): Promise<number> {
		const logGroupName = this.resolveLogGroupName(params.logGroupName);
		let total = 0;
		let nextToken: string | undefined;
		let pages = 0;

		do {
			const command = new FilterLogEventsCommand({
				logGroupName,
				filterPattern: params.filterPattern,
				startTime: Date.now() - params.minutesAgo * 60_000,
				endTime: Date.now(),
				limit: PAGE_SIZE,
				nextToken,
			});
			const response = await this.client.send(command);
			total += response.events?.length ?? 0;
			nextToken = response.nextToken;
			pages += 1;
		} while (nextToken && pages < MAX_COUNT_PAGES);

		return total;
	}

	// Resumo dos eventos: NÃO faz uma nova chamada de rede. Reaproveita queryEvents (até 50)
	// e agrega em memória — mesma decisão de design do summarizeLogs no DatadogService.
	public async summarizeEvents(params: LogQueryParams): Promise<AwsLogsSummary> {
		const logs = await this.queryEvents({ ...params, limit: 50 });

		const streamCounts = new Map<string, number>();
		for (const log of logs) {
			streamCounts.set(log.logStreamName, (streamCounts.get(log.logStreamName) ?? 0) + 1);
		}

		const byLogStream = [...streamCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([logStreamName, count]) => ({ logStreamName, count }));

		return { totalEvents: logs.length, byLogStream };
	}

	// Detalhes de um evento específico: relê a logStream ao redor do timestamp original
	// para trazer contexto (linhas antes/depois), já que o CloudWatch não tem "get by id".
	public async getEventDetails(eventId: string): Promise<AwsLogDetails> {
		const cached = this.detailsCache.get(eventId);
		if (cached) {
			console.error('[CACHE HIT] Retornando detalhes do evento do CloudWatch da memória.');
			return cached;
		}

		const payload = this.decodeEventId(eventId);
		console.error(`[CACHE MISS] Buscando contexto do evento na stream '${payload.logStreamName}'.`);

		const command = new GetLogEventsCommand({
			logGroupName: payload.logGroupName,
			logStreamName: payload.logStreamName,
			startTime: payload.timestamp - 5_000,
			endTime: payload.timestamp + 5_000,
			startFromHead: true,
		});
		const response = await this.client.send(command);
		const events = response.events || [];

		const centerIndex = events.findIndex((e) => e.timestamp === payload.timestamp);
		const index = centerIndex >= 0 ? centerIndex : Math.floor(events.length / 2);
		const contextBefore = events.slice(Math.max(0, index - 3), index).map((e) => (e.message ?? '').trim());
		const contextAfter = events.slice(index + 1, index + 4).map((e) => (e.message ?? '').trim());
		const center = events[index];

		const result = awsLogDetailsSchema.parse({
			id: eventId,
			timestamp: new Date(payload.timestamp).toISOString(),
			logStreamName: payload.logStreamName,
			message: (center?.message ?? '').trim(),
			tags: {
				logGroupName: payload.logGroupName,
				contextBefore: contextBefore.join('\n') || '(sem eventos anteriores nessa janela)',
				contextAfter: contextAfter.join('\n') || '(sem eventos posteriores nessa janela)',
			},
		});

		this.detailsCache.set(eventId, result);
		return result;
	}
}
