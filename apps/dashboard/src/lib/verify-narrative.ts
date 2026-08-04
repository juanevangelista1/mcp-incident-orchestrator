// Guarda-corpo anti-alucinação: o Gemini só deveria citar números que já existem no JSON de
// evidência que nós montamos (o prompt é explícito sobre isso), mas nada impede o modelo de
// "arredondar criativamente" ou inventar um número. Em vez de tentar reescrever o texto,
// comparamos os números citados contra os números que realmente existem na evidência e
// sinalizamos os que não batem — decisão consciente de avisar (banner na tela) em vez de
// bloquear/trocar por um template: essas três rotas são cliques manuais do usuário, não jobs
// de fundo, então a pessoa pode julgar o aviso no contexto em vez de receber um erro genérico.
//
// Duas formatações diferentes coexistem e precisam de parsing separado: a evidência vem de
// JSON.stringify (formato americano: "." é decimal, sem separador de milhar — ex: 30309.67),
// mas o texto do Gemini é escrito em português (formato brasileiro: "." é separador de
// milhar, "," é decimal — ex: "30.309,67"). Tratar os dois com a mesma regex/parse faz todo
// número com milhar (ex: "54.243") ser lido como "54.243" (quinhentos... não, 54 vírgula 243)
// e nunca bater com o valor real 54243 — foi exatamente esse falso positivo que apareceu no
// primeiro teste ao vivo desta função.

// Números pequenos (≤3) aparecem o tempo todo por motivos estruturais do texto (ex: "1-3
// hipóteses", listas numeradas) e não são "dados" no sentido que queremos auditar.
const IGNORE_THRESHOLD = 3;

// Números brutos do JSON.stringify(evidence): formato americano puro.
const EVIDENCE_NUMBER = /-?\d+(?:\.\d+)?/g;

// Números como o Gemini escreve em português: milhar com ".", decimal com ",".
const TEXT_NUMBER = /-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?/g;

function collectAllowedValues(evidence: unknown): number[] {
	const raw = JSON.stringify(evidence);
	const matches = raw.match(EVIDENCE_NUMBER) ?? [];
	return matches.map(Number).filter((v) => !Number.isNaN(v));
}

function parseBrazilianNumber(token: string): number {
	return Number(token.replace(/\./g, '').replace(',', '.'));
}

// Tolerância cobre arredondamento/truncamento entre o cálculo em JS e a forma como o modelo
// escreve o número (ex: baseline 30309.666... citado como "30.309,67" ou "30.310").
function isWithinTolerance(value: number, allowed: number[]): boolean {
	const abs = Math.abs(value);
	const tolerance = Math.max(1, abs * 0.01);
	return allowed.some((a) => Math.abs(Math.abs(a) - abs) <= tolerance);
}

// Retorna os tokens numéricos citados no texto gerado (como aparecem, ex: "54.243") que não
// têm correspondência (com tolerância) em nenhum valor da evidência — candidatos a
// alucinação, pra revisão humana.
export function findUnverifiedNumbers(text: string, evidence: unknown): string[] {
	const allowed = collectAllowedValues(evidence);
	const found = text.match(TEXT_NUMBER) ?? [];
	const suspicious = new Set<string>();

	for (const token of found) {
		const value = parseBrazilianNumber(token);
		if (Number.isNaN(value) || Math.abs(value) <= IGNORE_THRESHOLD) continue;
		if (!isWithinTolerance(value, allowed)) suspicious.add(token);
	}

	return [...suspicious];
}
