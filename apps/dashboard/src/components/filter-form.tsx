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
		<form
			method="get"
			action={action}
			className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 sm:flex sm:flex-wrap sm:items-end"
		>
			{fields.map((field) => (
				<label key={field.name} className="col-span-2 flex flex-col gap-1 text-xs sm:col-span-1">
					<span className="text-muted-foreground">{field.label}</span>
					<input
						type={field.type}
						name={field.name}
						defaultValue={values[field.name] ?? ''}
						placeholder={field.placeholder}
						className="w-full rounded-md border px-2 py-1.5 text-sm sm:w-auto"
					/>
				</label>
			))}
			<div className="col-span-2 flex gap-2 sm:col-span-1">
				<button
					type="submit"
					className="flex-1 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground sm:flex-none"
				>
					Filtrar
				</button>
				{hasActiveFilter && (
					<a
						href={action}
						className="text-muted-foreground flex items-center px-2 py-1.5 text-sm hover:underline"
					>
						Limpar
					</a>
				)}
			</div>
		</form>
	);
}
