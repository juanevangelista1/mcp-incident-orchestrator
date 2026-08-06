import type { jsPDF } from 'jspdf';
import type { ReportDocument } from './types';
import { parseMarkdownLines } from './markdown-lines';

const MARGIN = 40;
const PAGE_WIDTH = 595; // A4 em pt
const PAGE_BREAK_Y = 750;

// Desenha o corpo de uma seção de texto (Markdown) linha a linha: heading vira negrito
// maior, bullet/numerada ganham recuo, o resto é parágrafo normal — nenhuma delas mantém
// os símbolos "##"/"**"/"-" originais no PDF final.
function renderMarkdownBody(pdf: jsPDF, body: string, x: number, startY: number, maxWidth: number): number {
	let y = startY;
	for (const line of parseMarkdownLines(body)) {
		if (line.kind === 'blank') {
			y += 6;
			continue;
		}

		if (y > PAGE_BREAK_Y) {
			pdf.addPage();
			y = MARGIN;
		}

		let text = line.text;
		let indent = 0;
		let fontSize = 10;
		let bold = false;

		if (line.kind === 'heading') {
			bold = true;
			fontSize = 11;
			y += 4;
		} else if (line.kind === 'bullet') {
			text = `•  ${line.text}`;
			indent = 12;
		} else if (line.kind === 'numbered') {
			text = `${line.marker}  ${line.text}`;
			indent = 12;
		}

		pdf.setFont('helvetica', bold ? 'bold' : 'normal');
		pdf.setFontSize(fontSize);
		const wrapped: string[] = pdf.splitTextToSize(text, maxWidth - indent);
		pdf.text(wrapped, x + indent, y);
		y += wrapped.length * (fontSize + 2) + (bold ? 4 : 2);
	}

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(10);
	return y;
}

// Import dinâmico pelo mesmo motivo do to-excel.ts: jspdf/autotable só carregam no clique.
export async function downloadAsPdf(doc: ReportDocument, filenameBase: string): Promise<void> {
	const { jsPDF } = await import('jspdf');
	const autoTable = (await import('jspdf-autotable')).default;

	const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
	let y = MARGIN;

	pdf.setFontSize(16);
	pdf.text(doc.title, MARGIN, y);
	y += 20;

	if (doc.subtitle) {
		pdf.setFontSize(10);
		pdf.setTextColor(100);
		pdf.text(doc.subtitle, MARGIN, y);
		y += 16;
	}

	pdf.setFontSize(9);
	pdf.setTextColor(150);
	pdf.text(`Gerado em ${doc.generatedAt.toLocaleString('pt-BR')}`, MARGIN, y);
	y += 20;
	pdf.setTextColor(0);

	for (const section of doc.sections) {
		// Quebra de página manual antes de cada seção se sobrar pouco espaço — evita cortar
		// um título de seção sozinho no rodapé de uma página.
		if (y > 750) {
			pdf.addPage();
			y = MARGIN;
		}

		pdf.setFontSize(12);
		pdf.text(section.heading, MARGIN, y);
		y += 16;

		if (section.kind === 'kpi') {
			pdf.setFontSize(10);
			for (const item of section.items) {
				pdf.text(`${item.label}: ${item.value}`, MARGIN, y);
				y += 14;
			}
			y += 8;
		} else if (section.kind === 'text') {
			y = renderMarkdownBody(pdf, section.body, MARGIN, y, PAGE_WIDTH - MARGIN * 2);
			y += 8;
		} else if (section.kind === 'table') {
			if (section.description) {
				pdf.setFontSize(9);
				pdf.setTextColor(120);
				pdf.text(section.description, MARGIN, y);
				y += 12;
				pdf.setTextColor(0);
			}
			// Sem isso, colunas de cabeçalho curto (ex: "Severidade", "Ocorrências") ficam
			// espremidas pelas colunas de texto longo (título do erro) e o autoTable quebra o
			// cabeçalho letra por letra por falta de espaço em branco pra quebrar a palavra.
			// Largura mínima proporcional ao tamanho do próprio texto do cabeçalho resolve pra
			// qualquer tabela, sem precisar hardcodar nomes de coluna aqui.
			const columnStyles = Object.fromEntries(
				section.headers.map((h, i) => [i, { minCellWidth: h.length * 6 + 14 }]),
			);
			autoTable(pdf, {
				startY: y,
				head: [section.headers],
				body: section.rows,
				margin: { left: MARGIN, right: MARGIN },
				styles: { fontSize: 8, cellPadding: 4 },
				headStyles: { fillColor: [15, 23, 42] },
				columnStyles,
			});
			// `lastAutoTable` é anexado pelo plugin ao objeto pdf em tempo de execução — não faz
			// parte do tipo público do jsPDF, daí o cast.
			y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
		}
	}

	pdf.save(`${filenameBase}.pdf`);
}
