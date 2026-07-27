import { NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { SentryIssue } from '@/lib/mcp-types';
import { toCsv, csvResponse } from '@/lib/csv';

const PROJECT_SLUG = process.env.SENTRY_PROJECT_SLUG ?? '';

// Exporta exatamente o que a página /issues mostra: mesmos filtros (searchParams), mesmo
// limite de 20 imposto pela tool fetch_sentry_issues — não é um export "de tudo", é um
// export do recorte filtrado atual, honesto sobre a limitação da tool subjacente.
export async function GET(req: NextRequest) {
	const { searchParams } = req.nextUrl;
	const { data } = await callMcpTool<{ issues: SentryIssue[] }>('fetch_sentry_issues', {
		projectSlug: PROJECT_SLUG,
		environment: searchParams.get('environment') ?? undefined,
		route: searchParams.get('route') ?? undefined,
		startDate: searchParams.get('startDate') ?? undefined,
		endDate: searchParams.get('endDate') ?? undefined,
		search: searchParams.get('search') ?? undefined,
		level: searchParams.get('level') ?? undefined,
		limit: 100,
	});

	const csv = toCsv(data?.issues ?? [], ['id', 'title', 'culprit', 'count', 'permalink']);
	return csvResponse(csv, `sentry-issues-${new Date().toISOString().slice(0, 10)}.csv`);
}
