// Estrutura comum e neutra de formato — cada página monta um ReportDocument a partir dos
// dados que já buscou pra renderizar a própria tela (sem chamada nova a nenhuma API), e os
// geradores de Excel/PDF sabem desenhar qualquer ReportDocument sem conhecer a origem dos dados.
export interface ReportDocument {
	title: string;
	subtitle?: string;
	generatedAt: Date;
	sections: ReportSection[];
}

export type ReportSection = KpiSection | TableSection | TextSection;

export interface KpiSection {
	kind: 'kpi';
	heading: string;
	items: { label: string; value: string | number }[];
}

export interface TableSection {
	kind: 'table';
	heading: string;
	description?: string;
	headers: string[];
	rows: (string | number)[][];
}

export interface TextSection {
	kind: 'text';
	heading: string;
	body: string;
}
