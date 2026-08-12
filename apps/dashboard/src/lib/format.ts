// Contagens grandes (sessões, ocorrências, eventos) apareciam cruas na UI (ex.: 12345 em vez
// de 12.345) — só o separador de milhar do pt-BR, sem casas decimais (são sempre contagens
// inteiras). Percentuais continuam formatados no próprio ponto de uso (`.toFixed(1)%`).
export function formatNumberBR(n: number): string {
	return n.toLocaleString('pt-BR');
}
