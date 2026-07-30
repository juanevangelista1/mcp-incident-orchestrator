import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Nav } from '@/components/nav';
import './globals.css';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'Orquestrador de Incidentes - Dashboard',
	description: 'Dashboard de observabilidade (Sentry, Datadog, Clarity) via MCP',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang='pt-BR'
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<body className='min-h-full flex flex-col'>
				<a
					href='#main-content'
					className='sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground'>
					Pular para o conteúdo
				</a>
				<Nav />
				{children}
			</body>
		</html>
	);
}
