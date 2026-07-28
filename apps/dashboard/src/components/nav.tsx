'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Activity, Menu, X } from 'lucide-react';

const links = [
	{ href: '/', label: 'Overview' },
	{ href: '/issues', label: 'Issues (Sentry)' },
	{ href: '/logs', label: 'Logs (Datadog)' },
	{ href: '/insights', label: 'Insights (Clarity)' },
	{ href: '/insights/agendamento', label: 'Funil (agendamento)' },
	{ href: '/reports', label: 'Relatórios' },
	{ href: '/chat', label: 'Chat' },
];

export function Nav() {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	return (
		<nav
			aria-label="Navegação principal"
			className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
		>
			<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
				<Link href="/" className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
					<span
						aria-hidden="true"
						className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"
					>
						<Activity className="size-4" strokeWidth={2.5} />
					</span>
					Incident Orchestrator
				</Link>

				{/* Desktop: links inline. Mobile: só o botão de menu. */}
				<div className="hidden items-center gap-1 text-sm sm:flex">
					{links.map((link) => (
						<NavLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} />
					))}
				</div>

				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					aria-controls="mobile-menu"
					aria-label={open ? 'Fechar menu' : 'Abrir menu'}
					className="focus-visible:ring-ring flex size-9 items-center justify-center rounded-md border focus-visible:ring-2 focus-visible:outline-none sm:hidden"
				>
					{open ? <X aria-hidden="true" className="size-4" /> : <Menu aria-hidden="true" className="size-4" />}
				</button>
			</div>

			{open && (
				<div id="mobile-menu" className="flex flex-col gap-1 border-t px-4 py-3 text-sm sm:hidden">
					{links.map((link) => (
						<NavLink
							key={link.href}
							href={link.href}
							label={link.label}
							active={pathname === link.href}
							onClick={() => setOpen(false)}
							block
						/>
					))}
				</div>
			)}
		</nav>
	);
}

function NavLink({
	href,
	label,
	active,
	onClick,
	block,
}: {
	href: string;
	label: string;
	active: boolean;
	onClick?: () => void;
	block?: boolean;
}) {
	return (
		<Link
			href={href}
			onClick={onClick}
			aria-current={active ? 'page' : undefined}
			className={`focus-visible:ring-ring rounded-full px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${block ? 'block' : ''} ${
				active
					? 'bg-accent font-medium text-accent-foreground'
					: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
			}`}
		>
			{label}
		</Link>
	);
}
