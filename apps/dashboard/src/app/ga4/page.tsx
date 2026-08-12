import { callMcpTool } from '@/lib/mcp-client';
import { Ga4Summary } from '@/lib/mcp-types';
import { defaultGa4Range, formatDateBR, rangeIncludesToday } from '@/lib/date-format';
import { formatNumberBR } from '@/lib/format';
import { groupBookingEvents, type BookingEventItem } from '@/lib/ga4-booking-events';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-title';
import { PaginatedMetricList } from '@/components/paginated-metric-list';
import { Ga4Export } from '@/components/ga4-export';
import { TodayDelayWarning } from '@/components/today-delay-warning';
import { BarChart3 } from 'lucide-react';

function BookingEventColumn({ title, items }: { title: string; items: BookingEventItem[] }) {
	const subtotal = items.reduce((sum, i) => sum + i.count, 0);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-medium">{title}</h3>
				<span className="text-muted-foreground text-xs">{formatNumberBR(subtotal)}</span>
			</div>
			{items.length === 0 ? (
				<p className="text-muted-foreground text-xs">Nenhum evento no período.</p>
			) : (
				<ul className="flex flex-col gap-1.5">
					{items.map((item) => (
						<li key={item.eventName} className="flex items-center justify-between gap-2 text-sm">
							<span title={item.eventName} className="text-muted-foreground truncate">
								{item.label}
							</span>
							<span className="shrink-0 font-medium">{formatNumberBR(item.count)}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function RangeLabel({ from, to }: { from: string; to: string }) {
	return (
		<>
			{formatDateBR(from)} até {formatDateBR(to)}
		</>
	);
}

// O período (De/Até) é controlado só pelo filtro do card "Resumo" e vale para os outros cards
// também — evita o cenário de comparar "eventos de ontem" com "sessões dos últimos 30 dias" sem
// perceber. Cada card mantém seu próprio filtro extra (dispositivo/página/nome do evento) e sua
// própria lista/visualização, só a data é compartilhada. Padrão ontem→hoje (não mais 7 dias)
// porque é o intervalo que estava escondendo o dado mais recente atrás de uma janela larga
// demais por padrão.
type SearchParams = Promise<Record<string, string | undefined>>;

// Valores que a própria API do GA4 devolve na dimensão deviceCategory — mesmo cuidado de
// insights/page.tsx com o Clarity (o rótulo é livre, o value tem que bater com a API).
const DEVICE_OPTIONS = [
	{ value: '', label: 'Todos' },
	{ value: 'desktop', label: 'Desktop' },
	{ value: 'mobile', label: 'Mobile' },
	{ value: 'tablet', label: 'Tablet' },
];

interface CardFilters {
	from: string;
	to: string;
	pagePath?: string;
	device?: string;
	eventName?: string;
}

async function fetchGa4(filters: CardFilters): Promise<{ data: Ga4Summary | null; error: string | null }> {
	try {
		const { data, text } = await callMcpTool<Ga4Summary>('fetch_ga4_summary', {
			startDate: filters.from,
			endDate: filters.to,
			pagePath: filters.pagePath,
			device: filters.device,
			eventName: filters.eventName,
		});
		return { data: data ?? null, error: data ? null : text };
	} catch (error) {
		return { data: null, error: error instanceof Error ? error.message : 'GA4 não configurado no MCP server.' };
	}
}

// Inputs escondidos com os valores ATUAIS dos outros 3 cards — sem isso, cada card sendo um
// <form method="get"> independente reseta os filtros dos outros ao ser enviado (só os campos
// do próprio form entram na querystring).
function OtherCardsHidden({ all, ownPrefix }: { all: Record<string, string | undefined>; ownPrefix: string }) {
	return (
		<>
			{Object.entries(all)
				.filter(([key, value]) => value && !key.startsWith(ownPrefix))
				.map(([key, value]) => (
					<input key={key} type="hidden" name={key} value={value} />
				))}
		</>
	);
}

function CardFilterForm({
	prefix,
	all,
	from,
	to,
	showDates = true,
	extraField,
}: {
	prefix: string;
	all: Record<string, string | undefined>;
	from: string;
	to: string;
	showDates?: boolean;
	extraField?: { name: string; label: string; type: 'text' | 'select'; placeholder?: string; options?: { value: string; label: string }[] };
}) {
	return (
		<form method="get" action="/ga4" className="mb-3 flex flex-wrap items-end gap-2 border-b pb-3">
			<OtherCardsHidden all={all} ownPrefix={prefix} />
			{showDates ? (
				<>
					<label className="flex flex-col gap-1 text-xs">
						<span className="text-muted-foreground">De</span>
						<input
							type="date"
							name={`${prefix}_from`}
							defaultValue={from}
							className="focus-visible:ring-ring rounded-md border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
						/>
					</label>
					<label className="flex flex-col gap-1 text-xs">
						<span className="text-muted-foreground">Até</span>
						<input
							type="date"
							name={`${prefix}_to`}
							defaultValue={to}
							className="focus-visible:ring-ring rounded-md border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
						/>
					</label>
				</>
			) : (
				// Data vem do card Resumo (mesmo período pros 4 cards) — o kpi_from/kpi_to atual já
				// entra como campo oculto via OtherCardsHidden acima, não precisa repetir aqui.
				<span className="text-muted-foreground self-end pb-1.5 text-xs">
					Período: <RangeLabel from={from} to={to} /> (definido no card Resumo)
				</span>
			)}
			{extraField && (
				<label className="flex flex-col gap-1 text-xs">
					<span className="text-muted-foreground">{extraField.label}</span>
					{extraField.type === 'select' ? (
						<select
							name={extraField.name}
							defaultValue={all[extraField.name] ?? ''}
							className="focus-visible:ring-ring rounded-md border bg-background px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
						>
							{extraField.options?.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					) : (
						<input
							type="text"
							name={extraField.name}
							defaultValue={all[extraField.name] ?? ''}
							placeholder={extraField.placeholder}
							className="focus-visible:ring-ring rounded-md border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
						/>
					)}
				</label>
			)}
			<button
				type="submit"
				className="focus-visible:ring-ring rounded-md border px-3 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
			>
				Filtrar
			</button>
		</form>
	);
}

export default async function Ga4Page({ searchParams }: { searchParams: SearchParams }) {
	const all = await searchParams;
	const { from: defaultFrom, to: defaultTo } = defaultGa4Range();

	const range = (prefix: string): { from: string; to: string } => ({
		from: all[`${prefix}_from`] || defaultFrom,
		to: all[`${prefix}_to`] || defaultTo,
	});

	// Só o card Resumo controla De/Até — os outros 3 cards usam o mesmo `kpiRange`, cada um com
	// seu próprio filtro extra (dispositivo/página/evento) e sua própria lista, sem mesclar dados.
	const kpiRange = range('kpi');

	const [kpi, events, pages, devices] = await Promise.all([
		fetchGa4({ ...kpiRange, pagePath: all.kpi_pagePath, device: all.kpi_device }),
		fetchGa4({ ...kpiRange, eventName: all.events_eventName, device: all.events_device }),
		fetchGa4({ ...kpiRange, pagePath: all.pages_pagePath, device: all.pages_device }),
		fetchGa4({ ...kpiRange }),
	]);

	// Reaproveita o mesmo fetch do card "Resumo" (não faz chamada nova ao GA4) — só reorganiza
	// os eventos já buscados por tipo de negócio (locação/venda) e por ação, item a item.
	const bookingEvents = kpi.data ? groupBookingEvents(kpi.data.eventsByName) : null;

	return (
		<main id="main-content" className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<PageTitle
					icon={BarChart3}
					accent="bg-teal-600/10 text-teal-600 dark:text-teal-400"
					title="Google Analytics 4"
					subtitle={
						<p className="text-muted-foreground text-sm">
							Eventos reais: o período (De/Até) é definido uma vez no card Resumo e vale para os
							outros cards abaixo, cada um com seu próprio filtro extra (página/dispositivo/evento)
							e sua própria visualização. Nunca some com sessões do Clarity.
						</p>
					}
				/>
			</header>

			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-2">
						<CardTitle>Resumo</CardTitle>
						{kpi.data && (
							<Ga4Export
								data={kpi.data}
								from={kpiRange.from}
								to={kpiRange.to}
								pagePathFilter={all.kpi_pagePath}
								deviceFilter={all.kpi_device}
							/>
						)}
					</div>
					<CardDescription>
						<RangeLabel from={kpiRange.from} to={kpiRange.to} />
					</CardDescription>
				</CardHeader>
				<CardContent>
					<CardFilterForm
						prefix="kpi"
						all={all}
						from={kpiRange.from}
						to={kpiRange.to}
						extraField={{ name: 'kpi_device', label: 'Dispositivo', type: 'select', options: DEVICE_OPTIONS }}
					/>
					{rangeIncludesToday(kpiRange.to) && <TodayDelayWarning />}
					{!kpi.data ? (
						<p className="text-muted-foreground text-sm">
							{kpi.error || 'GA4 não configurado no MCP server (GA4_PROPERTY_ID/GA4_CLIENT_EMAIL/GA4_PRIVATE_KEY).'}
						</p>
					) : (
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<p className="text-muted-foreground text-xs">Sessões</p>
								<p className="text-xl font-semibold">{formatNumberBR(kpi.data.sessions)}</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">Usuários</p>
								<p className="text-xl font-semibold">{formatNumberBR(kpi.data.totalUsers)}</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{bookingEvents && (
				<Card>
					<CardHeader>
						<CardTitle>Agendamentos de visita</CardTitle>
						<CardDescription>
							<RangeLabel from={kpiRange.from} to={kpiRange.to} />: {formatNumberBR(bookingEvents.total)}{' '}
							no total (soma de todos os itens abaixo), cada evento contado separadamente e
							agrupado por locação/venda. Mesmo período e filtro de dispositivo do card Resumo.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{bookingEvents.total === 0 ? (
							<p className="text-muted-foreground text-sm">Nenhum evento de agendamento no período.</p>
						) : (
							<div className="grid gap-6 sm:grid-cols-2">
								<BookingEventColumn title="Locação" items={bookingEvents.locacao} />
								<BookingEventColumn title="Venda" items={bookingEvents.venda} />
								{bookingEvents.geral.length > 0 && (
									<BookingEventColumn title="Sem tipo (evento genérico)" items={bookingEvents.geral} />
								)}
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Contagem de eventos</CardTitle>
					<CardDescription>
						<RangeLabel from={kpiRange.from} to={kpiRange.to} />: todos os eventos do
						período, não só o de conversão.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<CardFilterForm
						prefix="events"
						all={all}
						from={kpiRange.from}
						to={kpiRange.to}
						showDates={false}
						extraField={{ name: 'events_eventName', label: 'Nome do evento', type: 'text', placeholder: 'visit_' }}
					/>
					{rangeIncludesToday(kpiRange.to) && <TodayDelayWarning />}
					{!events.data ? (
						<p className="text-muted-foreground text-sm">{events.error || 'Sem dados.'}</p>
					) : (
						<PaginatedMetricList
							items={events.data.eventsByName.map((e) => ({ label: e.eventName, value: e.count }))}
							barColor="bg-teal-500/15"
							emptyMessage="Nenhum evento no período."
						/>
					)}
				</CardContent>
			</Card>

			<section className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Páginas mais visitadas</CardTitle>
						<CardDescription>
							<RangeLabel from={kpiRange.from} to={kpiRange.to} />, por sessões.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<CardFilterForm
							prefix="pages"
							all={all}
							from={kpiRange.from}
							to={kpiRange.to}
							showDates={false}
							extraField={{ name: 'pages_pagePath', label: 'Página', type: 'text', placeholder: '/imovel/' }}
						/>
						{rangeIncludesToday(kpiRange.to) && <TodayDelayWarning />}
						{!pages.data ? (
							<p className="text-muted-foreground text-sm">{pages.error || 'Sem dados.'}</p>
						) : (
							<PaginatedMetricList
								items={pages.data.topPagesBySessions.map((p) => ({ label: p.page, value: p.sessions }))}
								barColor="bg-teal-500/15"
								emptyMessage="Sem dados."
							/>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Sessões por dispositivo</CardTitle>
						<CardDescription>
							<RangeLabel from={kpiRange.from} to={kpiRange.to} />
						</CardDescription>
					</CardHeader>
					<CardContent>
						{/* Sem filtro extra próprio (só dispositivo, que já é a própria métrica) — usa
						direto o período do card Resumo. */}
						<p className="text-muted-foreground mb-3 border-b pb-3 text-xs">
							Período: <RangeLabel from={kpiRange.from} to={kpiRange.to} /> (definido no card Resumo)
						</p>
						{rangeIncludesToday(kpiRange.to) && <TodayDelayWarning />}
						{!devices.data ? (
							<p className="text-muted-foreground text-sm">{devices.error || 'Sem dados.'}</p>
						) : (
							<PaginatedMetricList
								items={devices.data.sessionsByDevice.map((d) => ({ label: d.device, value: d.sessions }))}
								barColor="bg-teal-500/15"
								emptyMessage="Sem dados."
							/>
						)}
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
