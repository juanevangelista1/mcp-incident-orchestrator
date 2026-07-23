// Reaproveitado pelos links "Baixar CSV": o export deve refletir os mesmos filtros
// aplicados na tela, não sempre a lista inteira sem filtro.
export function toQueryString(values: Record<string, string | undefined>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(values)) {
		if (value) params.set(key, value);
	}
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}
