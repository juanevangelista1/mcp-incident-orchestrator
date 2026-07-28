import { NextResponse } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { ClarityInsights } from '@/lib/mcp-types';

export const dynamic = 'force-dynamic';

const BOOKING_URL_PATTERN = process.env.CLARITY_BOOKING_URL_PATTERN ?? '';

// Faz as 2 chamadas AO VIVO ao Clarity (total do site + filtrado pela URL de agendamento) só
// quando chamado — nunca automaticamente ao carregar a página. Isso existe porque navegar
// entre /insights, /insights/agendamento e /issues sem esse cuidado soma chaves de cache
// diferentes rapidinho e estoura o limite de 10 requisições/dia do Clarity (já aconteceu).
// A visão histórica (gratuita, sem chamar o Clarity) fica na própria página; isto aqui é só
// o "instantâneo de agora", sob demanda.
export async function POST() {
	if (!BOOKING_URL_PATTERN) {
		return NextResponse.json(
			{ error: 'CLARITY_BOOKING_URL_PATTERN não configurado no dashboard.' },
			{ status: 400 },
		);
	}

	try {
		const [totalResult, bookingResult] = await Promise.all([
			callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3 }),
			callMcpTool<ClarityInsights>('fetch_clarity_insights', { numOfDays: 3, url: BOOKING_URL_PATTERN }),
		]);
		const total = totalResult.data;
		const booking = bookingResult.data;
		if (!total || !booking) {
			return NextResponse.json({ error: totalResult.text || bookingResult.text || 'Clarity indisponível.' }, { status: 502 });
		}

		return NextResponse.json({
			totalSessions: total.totalSessions,
			bookingSessions: booking.totalSessions,
			rate: total.totalSessions > 0 ? (booking.totalSessions / total.totalSessions) * 100 : null,
			deviceData: mergeByKey(total.sessionsByDevice, booking.sessionsByDevice, 'device'),
			browserData: mergeByKey(total.sessionsByBrowser, booking.sessionsByBrowser, 'browser'),
		});
	} catch (error) {
		// Mensagem repassada como veio do ClarityService (ex: "Rate limit do Clarity excedido...")
		// — é informação útil pro usuário, não um detalhe interno a esconder.
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Falha ao consultar o Clarity.' },
			{ status: 502 },
		);
	}
}

function mergeByKey(
	totalRows: { count: number; [key: string]: string | number }[],
	bookingRows: { count: number; [key: string]: string | number }[],
	labelField: string,
): Record<string, string | number>[] {
	const bookingByLabel = new Map(bookingRows.map((r) => [String(r[labelField]), r.count]));
	return totalRows.map((r) => ({
		label: String(r[labelField]),
		total: r.count,
		booking: bookingByLabel.get(String(r[labelField])) ?? 0,
	}));
}
