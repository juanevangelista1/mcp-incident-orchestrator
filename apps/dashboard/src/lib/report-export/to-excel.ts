import type { ReportDocument } from './types';

// Import dinâmico (ver report-export-button.tsx): exceljs só entra no bundle do navegador
// quando o usuário realmente clica em exportar, não no carregamento inicial da página.
export async function downloadAsExcel(doc: ReportDocument, filenameBase: string): Promise<void> {
	const ExcelJS = (await import('exceljs')).default;
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'Incident Orchestrator';
	workbook.created = doc.generatedAt;

	const summarySheet = workbook.addWorksheet('Resumo');
	summarySheet.columns = [{ width: 40 }, { width: 60 }];
	summarySheet.addRow([doc.title]).font = { bold: true, size: 14 };
	if (doc.subtitle) summarySheet.addRow([doc.subtitle]);
	summarySheet.addRow([`Gerado em ${doc.generatedAt.toLocaleString('pt-BR')}`]);
	summarySheet.addRow([]);

	for (const section of doc.sections) {
		if (section.kind === 'kpi') {
			summarySheet.addRow([section.heading]).font = { bold: true };
			for (const item of section.items) {
				summarySheet.addRow([item.label, item.value]);
			}
			summarySheet.addRow([]);
		} else if (section.kind === 'text') {
			summarySheet.addRow([section.heading]).font = { bold: true };
			summarySheet.addRow([section.body]);
			summarySheet.addRow([]);
		}
	}

	// Cada tabela vira sua própria aba — mistura mal com o resumo (colunas variam de tamanho).
	for (const section of doc.sections) {
		if (section.kind !== 'table') continue;
		const sheet = workbook.addWorksheet(section.heading.slice(0, 31) || 'Dados');
		sheet.columns = section.headers.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 2) }));
		sheet.getRow(1).font = { bold: true };
		for (const row of section.rows) {
			sheet.addRow(row);
		}
	}

	const buffer = await workbook.xlsx.writeBuffer();
	triggerDownload(new Blob([buffer]), `${filenameBase}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
