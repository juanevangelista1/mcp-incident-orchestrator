import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Mesmo padrão visual (ícone colorido + título) reaproveitado em todas as páginas — reforça
// de relance qual fonte de dado (Sentry/Datadog/AWS/Clarity/...) está sendo exibida.
export function PageTitle({
	icon: Icon,
	accent,
	title,
	subtitle,
}: {
	icon: LucideIcon;
	accent: string;
	title: string;
	subtitle?: ReactNode;
}) {
	return (
		<div className="flex items-center gap-3">
			<span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
				<Icon className="size-5" />
			</span>
			<div>
				<h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
				{subtitle}
			</div>
		</div>
	);
}
