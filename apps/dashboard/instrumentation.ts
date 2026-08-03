// Roda uma vez quando o servidor Next.js sobe (dev ou produção local — na Vercel o
// vercel.json já agenda /api/cron/daily-digest sozinho, então esse arquivo é só pro ambiente
// local, onde não existe nenhum scheduler externo chamando a rota).
//
// Dois papéis: (1) catch-up imediato se o dia de hoje ainda não tem digest (resolve o caso de
// ligar o dev server depois de vários dias parado, sem esperar até as 6h da manhã seguinte);
// (2) agenda node-cron pro mesmo horário do vercel.json (0 6 * * *), pra manter o digest
// rodando sozinho enquanto o processo do dashboard estiver de pé.
export async function register() {
	if (process.env.NEXT_RUNTIME !== 'nodejs') return;

	const { runDailyDigest, hasTodaysDigest } = await import('@/lib/daily-digest');
	const cron = (await import('node-cron')).default;

	if (!hasTodaysDigest()) {
		console.error('[daily-digest] Nenhum digest de hoje ainda — rodando catch-up local.');
		runDailyDigest().catch((error) => console.error('[daily-digest] Falha no catch-up local:', error));
	}

	cron.schedule('0 6 * * *', () => {
		runDailyDigest().catch((error) => console.error('[daily-digest] Falha na execução agendada:', error));
	});
}
