import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigest } from '@/lib/daily-digest';

export async function GET(req: NextRequest) {
	const authHeader = req.headers.get('authorization');
	if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { report } = await runDailyDigest();

	return NextResponse.json({ ok: true, report });
}
