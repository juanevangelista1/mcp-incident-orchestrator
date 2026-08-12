import { TriangleAlert } from 'lucide-react';

// Reaproveitado em toda página com filtro de data que pode incluir hoje (GA4, Issues, Datadog,
// Clarity, Reports) — todas essas plataformas têm algum atraso de processamento entre o evento
// acontecer e aparecer na API, então o número de hoje ainda pode subir depois de consultado.
export function TodayDelayWarning() {
	return (
		<p className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
			<TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
			O período inclui o dia de hoje: os dados de hoje podem estar incompletos (delay de
			processamento da plataforma) e ainda mudar.
		</p>
	);
}
