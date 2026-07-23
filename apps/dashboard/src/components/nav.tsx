'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
	{ href: '/', label: 'Overview' },
	{ href: '/issues', label: 'Issues (Sentry)' },
	{ href: '/logs', label: 'Logs (Datadog)' },
	{ href: '/aws', label: 'Logs (AWS)' },
	{ href: '/insights', label: 'Insights (Clarity)' },
	{ href: '/reports', label: 'Relatórios' },
	{ href: '/chat', label: 'Chat' },
];

export function Nav() {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	return (
		<nav className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
			<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
				<Link href="/" className="font-heading text-sm font-semibold tracking-tight">
					Incident Orchestrator
				</Link>

				{/* Desktop: links inline. Mobile: só o botão de menu. */}
				<div className="hidden items-center gap-5 text-sm sm:flex">
					{links.map((link) => (
						<NavLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} />
					))}
				</div>

				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					aria-label="Abrir menu"
					className="flex size-9 items-center justify-center rounded-md border sm:hidden"
				>
					<span className="sr-only">Menu</span>
					{open ? '✕' : '☰'}
				</button>
			</div>

			{open && (
				<div className="flex flex-col gap-1 border-t px-4 py-3 text-sm sm:hidden">
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
			className={`${block ? 'block rounded-md px-2 py-2' : ''} ${
				active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
			}`}
		>
			{label}
		</Link>
	);
}
