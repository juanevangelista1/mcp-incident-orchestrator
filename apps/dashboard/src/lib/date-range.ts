const DEFAULT_MINUTES_AGO = 60;
// 24h — teto escolhido aqui no dashboard, não pela API do Datadog (que aceita até 7 dias/10080min,
// ver `minutesAgo` em datadog.schema.ts). Mantido como default conservador para a busca básica de
// /datadog; quem precisar de mais histórico usa o campo "Busca avançada" com uma query maior.
const MAX_MINUTES_AGO = 1440;

// Datadog e AWS CloudWatch só aceitam uma janela relativa terminando "agora" (minutesAgo),
// não um intervalo [de, até] absoluto como o Sentry. Um <input type="date"> no formulário de
// filtro vira essa janela: "de" quantos minutos atrás até agora. Se o usuário escolher uma
// data com mais de 24h, a janela é limitada a 24h (limite do dashboard, não da API — ver acima).
export function dateToMinutesAgo(dateStr: string | undefined): number {
	if (!dateStr) return DEFAULT_MINUTES_AGO;

	const since = new Date(`${dateStr}T00:00:00`).getTime();
	if (Number.isNaN(since)) return DEFAULT_MINUTES_AGO;

	const minutesAgo = Math.ceil((Date.now() - since) / 60_000);
	return Math.min(Math.max(minutesAgo, 1), MAX_MINUTES_AGO);
}
