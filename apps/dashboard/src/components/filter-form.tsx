export interface FilterField {
	name: string;
	label: string;
	type: 'text' | 'date';
	placeholder?: string;
}

// Form GET puro (sem 'use client', sem JS): o navegador já sabe recarregar a página com os
// campos preenchidos como searchParams — o Server Component lê `searchParams` e refaz a
// busca no MCP server. Mesma filosofia do resto do dashboard: HTML/HTTP antes de JS.
export function FilterForm({
	fields,
	values,
	action,
}: {
	fields: FilterField[];
	values: Record<string, string | undefined>;
	action: string;
}) {
	const hasActiveFilter = Object.values(values).some(Boolean);

	return (
		<form method="get" action={action} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
			{fields.map((field) => (
				<label key={field.name} className="flex flex-col gap-1 text-xs">
					<span className="text-muted-foreground">{field.label}</span>
					<input
						type={field.type}
						name={field.name}
						defaultValue={values[field.name] ?? ''}
						placeholder={field.placeholder}
						className="rounded-md border px-2 py-1.5 text-sm"
					/>
				</label>
			))}
			<div className="flex gap-2">
				<button type="submit" className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">
					Filtrar
				</button>
				{hasActiveFilter && (
					<a href={action} className="text-muted-foreground px-2 py-1.5 text-sm hover:underline">
						Limpar
					</a>
				)}
			</div>
		</form>
	);
}
