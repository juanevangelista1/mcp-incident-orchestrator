// Cache genérico com expiração (TTL) e tamanho máximo, reaproveitado por qualquer serviço
// que precise de memoization (proteção de rate limit/custo contra chamadas repetidas da IA).
// Evita duplicar a mesma lógica de Map<string, {data, expiresAt}> em cada service.
export class TtlCache<T> {
	private readonly store = new Map<string, { value: T; expiresAt: number }>();

	constructor(
		private readonly ttlMs: number,
		private readonly maxEntries: number = 500,
	) {}

	public get(key: string): T | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;

		if (entry.expiresAt <= Date.now()) {
			this.store.delete(key); // poda a entrada expirada em vez de deixá-la vazando memória
			return undefined;
		}

		return entry.value;
	}

	public set(key: string, value: T): void {
		if (this.store.size >= this.maxEntries) {
			const oldestKey = this.store.keys().next().value;
			if (oldestKey !== undefined) this.store.delete(oldestKey);
		}
		this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
	}
}
