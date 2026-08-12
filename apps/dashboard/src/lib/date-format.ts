// Datas do digest diário vêm do banco como string ISO "YYYY-MM-DD" (chave de ordenação/upsert
// em daily_reports) — exibir isso cru na UI mostra "2026-08-06" em vez do formato brasileiro
// dia/mês/ano. Funções puras de string (sem `Date`/timezone) porque a entrada já é uma data
// sem hora, e passar por `Date` só arriscaria off-by-one por fuso horário.

// "2026-08-06" -> "06/08/2026"
export function formatDateBR(iso: string): string {
	const [y, m, d] = iso.split('-');
	if (!y || !m || !d) return iso;
	return `${d}/${m}/${y}`;
}

// "2026-08-06" -> "06/08" — rótulo compacto para eixo de gráfico (sparklines de 14 dias).
export function formatDateShortBR(iso: string): string {
	const [, m, d] = iso.split('-');
	if (!m || !d) return iso;
	return `${d}/${m}`;
}

// "2026-08" -> "08/2026" — chave do rollup mensal (monthOf em trends.ts), sem dia.
export function formatMonthBR(iso: string): string {
	const [y, m] = iso.split('-');
	if (!y || !m) return iso;
	return `${m}/${y}`;
}

// Intervalo padrão pros seletores de data por card do GA4: ontem até hoje (inclusive) — pedido
// explícito, já que o padrão anterior (7 dias) escondia o dado mais recente atrás de uma janela
// larga. `toISOString().slice(0,10)` já é o formato AAAA-MM-DD que <input type="date"> e a API
// do GA4 esperam.
export function defaultGa4Range(): { from: string; to: string } {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	return { from: yesterday.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

export function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}

// Sentry/Datadog/Clarity/GA4 todos têm algum atraso de processamento entre o evento acontecer
// e aparecer na API — se o período consultado chega até hoje, o número de hoje pode subir
// depois. Comparação de string funciona porque o formato é sempre AAAA-MM-DD (ordenável).
export function rangeIncludesToday(to: string | undefined | null): boolean {
	if (!to) return true; // sem "até" explícito normalmente significa "até agora"
	return to >= todayISO();
}
