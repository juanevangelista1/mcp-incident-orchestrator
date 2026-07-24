import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Monta o caminho de um arquivo dentro de `apps/mcp-server/.cache/`, a partir do `__dirname`
// do service que está chamando (que fica em `src/`, um nível abaixo da raiz do pacote).
// Centraliza essa conta em vez de repetir `dirname(...)` em cada service que precisa de
// cache persistente. Usa `__dirname` (não `import.meta.url`): o pacote compila para CommonJS
// (sem `"type": "module"` no package.json), onde `import.meta` não é permitido.
export function cacheFilePath(serviceDirname: string, fileName: string): string {
	return `${serviceDirname}/../.cache/${fileName}`;
}

// Cache genérico com expiração (TTL) e tamanho máximo, reaproveitado por qualquer serviço
// que precise de memoization (proteção de rate limit/custo contra chamadas repetidas da IA).
// Evita duplicar a mesma lógica de Map<string, {data, expiresAt}> em cada service.
//
// Persistência opcional em disco (`persistFile`): sem isso, o cache mora só na memória do
// processo — e o servidor MCP reinicia com frequência (tsx watch em dev, deploy, crash em
// produção), o que zera o cache e volta a gastar cota logo depois de reiniciar. Passando um
// caminho de arquivo, o cache é lido do disco na construção e regravado a cada `set`,
// sobrevivendo a reinícios. Uso mais crítico: ClarityService, cuja API tem teto de
// 10 requisições/dia por projeto.
export class TtlCache<T> {
	private readonly store = new Map<string, { value: T; expiresAt: number }>();

	constructor(
		private readonly ttlMs: number,
		private readonly maxEntries: number = 500,
		private readonly persistFile?: string,
	) {
		if (this.persistFile) this.loadFromDisk();
	}

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
		if (this.persistFile) this.saveToDisk();
	}

	private loadFromDisk(): void {
		try {
			if (!existsSync(this.persistFile!)) return;
			const raw = JSON.parse(readFileSync(this.persistFile!, 'utf-8')) as Record<
				string,
				{ value: T; expiresAt: number }
			>;
			const now = Date.now();
			for (const [key, entry] of Object.entries(raw)) {
				// Só recupera entradas que ainda não expiraram — cache velho de um restart
				// anterior não deve reviver dado obsoleto.
				if (entry.expiresAt > now) this.store.set(key, entry);
			}
		} catch {
			// Arquivo de cache corrompido/ilegível: segue com cache vazio em vez de derrubar o serviço.
		}
	}

	private saveToDisk(): void {
		try {
			mkdirSync(dirname(this.persistFile!), { recursive: true });
			const serializable = Object.fromEntries(this.store.entries());
			writeFileSync(this.persistFile!, JSON.stringify(serializable), 'utf-8');
		} catch {
			// Falha ao gravar em disco não deve derrubar a chamada que gerou o dado — o cache
			// simplesmente volta a se comportar como memory-only até o próximo `set` bem-sucedido.
		}
	}
}
