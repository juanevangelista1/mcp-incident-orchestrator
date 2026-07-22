import Link from 'next/link';

const links = [
	{ href: '/', label: 'Overview' },
	{ href: '/issues', label: 'Issues (Sentry)' },
	{ href: '/logs', label: 'Logs (Datadog)' },
	{ href: '/insights', label: 'Insights (Clarity)' },
	{ href: '/chat', label: 'Chat' },
];

export function Nav() {
	return (
		<nav className="border-b bg-background">
			<div className="mx-auto flex max-w-5xl gap-6 px-8 py-3 text-sm">
				{links.map((link) => (
					<Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
						{link.label}
					</Link>
				))}
			</div>
		</nav>
	);
}
