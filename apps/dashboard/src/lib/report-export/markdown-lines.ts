// Os relatórios narrativos (Gemini) vêm em Markdown (## Seção, **negrito**, listas). jsPDF e
// exceljs não entendem Markdown — sem isso, "## Sintoma" e "**Hipótese:**" apareciam literalmente
// no PDF/Excel exportado. Não é um parser de Markdown completo (sem tabelas, links, code blocks
// aninhados): só o suficiente pra estrutura que o prompt do Gemini realmente produz.
export type MarkdownLine =
	| { kind: 'heading'; text: string }
	| { kind: 'bullet'; text: string }
	| { kind: 'numbered'; marker: string; text: string }
	| { kind: 'text'; text: string }
	| { kind: 'blank' };

function stripInlineMarkdown(s: string): string {
	return s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`(.*?)`/g, '$1');
}

export function parseMarkdownLines(body: string): MarkdownLine[] {
	return body.split('\n').map((raw): MarkdownLine => {
		const line = raw.trim();
		if (!line) return { kind: 'blank' };

		const heading = line.match(/^#{1,6}\s+(.*)/);
		if (heading) return { kind: 'heading', text: stripInlineMarkdown(heading[1]) };

		const bullet = line.match(/^[-*]\s+(.*)/);
		if (bullet) return { kind: 'bullet', text: stripInlineMarkdown(bullet[1]) };

		const numbered = line.match(/^(\d+)\.\s+(.*)/);
		if (numbered) return { kind: 'numbered', marker: `${numbered[1]}.`, text: stripInlineMarkdown(numbered[2]) };

		return { kind: 'text', text: stripInlineMarkdown(line) };
	});
}
