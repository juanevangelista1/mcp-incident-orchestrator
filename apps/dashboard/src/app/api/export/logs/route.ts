import { NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { DatadogLogEntry } from '@/lib/mcp-types';
import { dateToMinutesAgo } from '@/lib/date-range';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET(req: NextRequest) {
	const { searchParams } = req.nextUrl;
	const { data } = await callMcpTool<{ logs: DatadogLogEntry[] }>('fetch_datadog_logs', {
		query: searchParams.get('query') ?? undefined,
		service: searchParams.get('service') ?? undefined,
		environment: searchParams.get('environment') ?? undefined,
		minutesAgo: dateToMinutesAgo(searchParams.get('since') ?? undefined),
		limit: 50,
	});

	const csv = toCsv(data?.logs ?? [], ['id', 'timestamp', 'status', 'service', 'host', 'message']);
	return csvResponse(csv, `datadog-logs-${new Date().toISOString().slice(0, 10)}.csv`);
}
