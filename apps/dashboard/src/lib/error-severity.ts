import { SentryIssue } from '@/lib/mcp-types';

export type Severity = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';

export interface RankedIssue extends SentryIssue {
	severity: Severity;
}

// Heurística de severidade por percentil de ocorrências DENTRO do próprio conjunto retornado
// (não é um campo oficial do Sentry — ele não classifica issues por volume). Top 10% dos
// erros mais frequentes = Crítico, próximos 20% = Alto, próximos 30% = Médio, resto = Baixo.
// Precisa ser recalculada a cada consulta: o mesmo erro pode ser "Crítico" numa lista de 5
// issues e "Baixo" numa lista de 100 — é relativo ao lote, não absoluto.
export function classifySeverity(issues: SentryIssue[]): RankedIssue[] {
	const sorted = [...issues].sort((a, b) => b.count - a.count);
	const n = sorted.length;

	return sorted.map((issue, i) => {
		const percentile = n <= 1 ? 0 : i / n;
		let severity: Severity;
		if (percentile < 0.1) severity = 'Crítico';
		else if (percentile < 0.3) severity = 'Alto';
		else if (percentile < 0.6) severity = 'Médio';
		else severity = 'Baixo';
		return { ...issue, severity };
	});
}

export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
	Crítico: 'bg-rose-600/10 text-rose-600 dark:text-rose-400',
	Alto: 'bg-orange-600/10 text-orange-600 dark:text-orange-400',
	Médio: 'bg-amber-600/10 text-amber-600 dark:text-amber-400',
	Baixo: 'bg-slate-600/10 text-slate-600 dark:text-slate-400',
};

export interface PageRankRow {
	page: string;
	sentryOccurrences: number;
}

// Ranking de páginas por volume de erro no Sentry, agrupando pelo `culprit` (rota/arquivo que
// a própria issue já traz). É uma agregação em memória sobre o que já foi buscado — sem
// chamada de API extra.
export function rankPagesByOccurrences(issues: SentryIssue[], limit = 10): PageRankRow[] {
	const totals = new Map<string, number>();
	for (const issue of issues) {
		totals.set(issue.culprit, (totals.get(issue.culprit) ?? 0) + issue.count);
	}
	return [...totals.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([page, sentryOccurrences]) => ({ page, sentryOccurrences }));
}
