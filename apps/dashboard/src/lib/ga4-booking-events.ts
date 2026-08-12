import type { Ga4Summary } from '@/lib/mcp-types';

export interface BookingEventItem {
	eventName: string;
	label: string;
	count: number;
}

export interface BookingEventGroups {
	locacao: BookingEventItem[];
	venda: BookingEventItem[];
	geral: BookingEventItem[];
	total: number;
}

// Ordem importa: "schedule_completed" é substring de "reschedule_completed" (re+SCHEDULE_COMPLETED),
// então os padrões mais específicos (reschedule/submit) têm que ser checados ANTES do genérico
// "schedule_completed", senão todo reagendamento cairia classificado como "Agendamento concluído".
// "shedule"/"submit_shedule_failed" (sem o "c") são eventos legados com erro de digitação que
// ainda ocorrem nos dados reais (confirmado numa chamada ao vivo à API do GA4) — mantidos com
// rótulo próprio em vez de descartados, pra não sumir agendamentos antigos da contagem.
const BOOKING_EVENT_TYPES: { pattern: string; label: string }[] = [
	{ pattern: 'submit_reschedule_failed', label: 'Falha ao reagendar' },
	{ pattern: 'submit_schedule_failed', label: 'Falha ao agendar' },
	{ pattern: 'submit_shedule_failed', label: 'Falha ao agendar (legado)' },
	{ pattern: 'reschedule_completed', label: 'Reagendamento concluído' },
	{ pattern: 'shedule_completed', label: 'Agendamento concluído (legado)' },
	{ pattern: 'schedule_completed', label: 'Agendamento concluído' },
];

// Agrupa os eventos de agendamento/reagendamento já presentes em `eventsByName` (não faz nova
// chamada ao GA4) por tipo de negócio (locação/venda/sem sufixo) e por ação (concluído/falha),
// item a item — em vez de um único total somado, que escondia de onde vinha o número.
export function groupBookingEvents(eventsByName: Ga4Summary['eventsByName']): BookingEventGroups {
	const groups: BookingEventGroups = { locacao: [], venda: [], geral: [], total: 0 };

	for (const event of eventsByName) {
		const type = BOOKING_EVENT_TYPES.find((t) => event.eventName.includes(t.pattern));
		if (!type) continue;

		const item: BookingEventItem = { eventName: event.eventName, label: type.label, count: event.count };
		if (event.eventName.endsWith('_locacao')) groups.locacao.push(item);
		else if (event.eventName.endsWith('_venda')) groups.venda.push(item);
		else groups.geral.push(item);
		groups.total += event.count;
	}

	return groups;
}
