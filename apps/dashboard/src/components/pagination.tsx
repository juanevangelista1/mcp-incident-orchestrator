import Link from 'next/link';

const PAGE_SIZE_DEFAULT = 10;

export const PAGE_SIZE = PAGE_SIZE_DEFAULT;

// Paginação simples client-side sobre uma lista já carregada (a tool MCP já trouxe até
// `limit` itens de uma vez) — não pagina a chamada de rede, só a exibição, então não
// precisa de mais nenhuma chamada ao MCP server para trocar de página.
export function Pagination({
	page,
	totalPages,
	basePath,
	params,
}: {
	page: number;
	totalPages: number;
	basePath: string;
	params: Record<string, string | undefined>;
}) {
	if (totalPages <= 1) return null;

	const hrefFor = (p: number) => {
		const qs = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			if (value) qs.set(key, value);
		}
		if (p > 1) qs.set('page', String(p));
		const search = qs.toString();
		return search ? `${basePath}?${search}` : basePath;
	};

	const linkClass =
		'focus-visible:ring-ring rounded-md border px-3 py-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:outline-none';
	const disabledClass = 'text-muted-foreground/50 rounded-md border px-3 py-1.5 cursor-not-allowed';

	return (
		<nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
			{page <= 1 ? (
				<span className={disabledClass} aria-disabled="true">
					Anterior
				</span>
			) : (
				<Link href={hrefFor(page - 1)} className={linkClass}>
					Anterior
				</Link>
			)}
			<span className="text-muted-foreground">
				Página {page} de {totalPages}
			</span>
			{page >= totalPages ? (
				<span className={disabledClass} aria-disabled="true">
					Próxima
				</span>
			) : (
				<Link href={hrefFor(page + 1)} className={linkClass}>
					Próxima
				</Link>
			)}
		</nav>
	);
}
