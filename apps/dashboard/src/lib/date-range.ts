const DEFAULT_MINUTES_AGO = 60;
const MAX_MINUTES_AGO = 1440; // 24h — teto aceito pelas tools do Datadog/AWS no mcp-server

// Datadog e AWS CloudWatch só aceitam uma janela relativa terminando "agora" (minutesAgo),
// não um intervalo [de, até] absoluto como o Sentry. Um <input type="date"> no formulário de
// filtro vira essa janela: "de" quantos minutos atrás até agora. Se o usuário escolher uma
// data com mais de 24h, a janela é limitada a 24h (o máximo que a API aceita).
export function dateToMinutesAgo(dateStr: string | undefined): number {
	if (!dateStr) return DEFAULT_MINUTES_AGO;

	const since = new Date(`${dateStr}T00:00:00`).getTime();
	if (Number.isNaN(since)) return DEFAULT_MINUTES_AGO;

	const minutesAgo = Math.ceil((Date.now() - since) / 60_000);
	return Math.min(Math.max(minutesAgo, 1), MAX_MINUTES_AGO);
}
