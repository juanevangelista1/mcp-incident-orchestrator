export interface FilterField {
	name: string;
	label: string;
	type: 'text' | 'date' | 'select';
	placeholder?: string;
	options?: { value: string; label: string }[];
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
			role="search"
			aria-label="Filtros de busca"
			className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 sm:flex sm:flex-wrap sm:items-end"
		>
			{fields.map((field) => (
				<label key={field.name} className="col-span-2 flex flex-col gap-1 text-xs sm:col-span-1">
					<span className="text-muted-foreground">{field.label}</span>
					{field.type === 'select' ? (
						<select
							name={field.name}
							defaultValue={values[field.name] ?? ''}
							className="focus-visible:ring-ring w-full rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none sm:w-auto"
						>
							<option value="">Todos</option>
							{field.options?.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					) : (
						<input
							type={field.type}
							name={field.name}
							defaultValue={values[field.name] ?? ''}
							placeholder={field.placeholder}
							className="focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none sm:w-auto"
						/>
					)}
				</label>
			))}
			<div className="col-span-2 flex gap-2 sm:col-span-1">
				<button
					type="submit"
					className="focus-visible:ring-ring flex-1 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:outline-none sm:flex-none"
				>
					Filtrar
				</button>
				{hasActiveFilter && (
					<a
						href={action}
						className="focus-visible:ring-ring text-muted-foreground flex items-center rounded-md px-2 py-1.5 text-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
					>
						Limpar filtros
					</a>
				)}
			</div>
		</form>
	);
}
