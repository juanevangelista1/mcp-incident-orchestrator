import type { ReportDocument } from './types';

const MARGIN = 40;
const PAGE_WIDTH = 595; // A4 em pt

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
			pdf.setFontSize(10);
			const lines = pdf.splitTextToSize(section.body, PAGE_WIDTH - MARGIN * 2);
			pdf.text(lines, MARGIN, y);
			y += lines.length * 12 + 8;
		} else if (section.kind === 'table') {
			if (section.description) {
				pdf.setFontSize(9);
				pdf.setTextColor(120);
				pdf.text(section.description, MARGIN, y);
				y += 12;
				pdf.setTextColor(0);
			}
			autoTable(pdf, {
				startY: y,
				head: [section.headers],
				body: section.rows,
				margin: { left: MARGIN, right: MARGIN },
				styles: { fontSize: 8, cellPadding: 4 },
				headStyles: { fillColor: [15, 23, 42] },
			});
			// `lastAutoTable` é anexado pelo plugin ao objeto pdf em tempo de execução — não faz
			// parte do tipo público do jsPDF, daí o cast.
			y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
		}
	}

	pdf.save(`${filenameBase}.pdf`);
}
