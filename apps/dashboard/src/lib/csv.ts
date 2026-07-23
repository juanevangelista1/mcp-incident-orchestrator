// CSV manual, sem lib externa: o formato é simples o bastante (escapar aspas/vírgulas/quebras
// de linha) que adicionar uma dependência só pra isso seria over-engineering para o escopo atual.
function escapeCsvValue(value: unknown): string {
	const str = value === null || value === undefined ? '' : String(value);
	if (/[",\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function toCsv<T>(rows: T[], columns: (keyof T & string)[]): string {
	const header = columns.join(',');
	const lines = rows.map((row) => columns.map((col) => escapeCsvValue(row[col])).join(','));
	return [header, ...lines].join('\n');
}

export function csvResponse(csv: string, filename: string): Response {
	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	});
}
