// Fallback do Suspense automático do Next (`loading.tsx` por rota) — aparece assim que o
// usuário navega (submete um filtro, pagina, troca de página) enquanto o Server Component busca
// dado ao vivo do MCP server (Sentry/Datadog/Clarity/GA4, às vezes as 4 juntas). Sem isso, essas
// páginas ficavam sem nenhum feedback visual durante o request, o que parecia travado.
export function PageLoading() {
	return (
		<main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8" aria-busy="true" aria-live="polite">
			<div className="flex items-center gap-3">
				<span className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
				<div className="flex flex-col gap-2">
					<span className="h-6 w-48 animate-pulse rounded bg-muted" />
					<span className="h-4 w-64 animate-pulse rounded bg-muted" />
				</div>
			</div>
			<div className="h-24 animate-pulse rounded-lg border bg-muted/40" />
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="h-40 animate-pulse rounded-lg border bg-muted/40" />
				<div className="h-40 animate-pulse rounded-lg border bg-muted/40" />
			</div>
		</main>
	);
}
