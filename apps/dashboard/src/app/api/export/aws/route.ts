import { NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { AwsLogEntry } from '@/lib/mcp-types';
import { dateToMinutesAgo } from '@/lib/date-range';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET(req: NextRequest) {
	const { searchParams } = req.nextUrl;
	const { data } = await callMcpTool<{ logs: AwsLogEntry[] }>('fetch_aws_logs', {
		filterPattern: searchParams.get('filterPattern') ?? undefined,
		logGroupName: searchParams.get('logGroupName') ?? undefined,
		minutesAgo: dateToMinutesAgo(searchParams.get('since') ?? undefined),
		limit: 50,
	});

	const csv = toCsv(data?.logs ?? [], ['id', 'timestamp', 'logStreamName', 'message']);
	return csvResponse(csv, `aws-logs-${new Date().toISOString().slice(0, 10)}.csv`);
}
