import { DailyPoint, percentChange } from '@/lib/trends';

export interface Scenario {
	code: string;
	label: string;
	description: string;
	evidence: string[];
}

// Mesmos limiares usados nos badges de alerta da página de Comparativos — ponto de partida
// ajustável, não uma verdade absoluta (ainda não há baseline histórico suficiente para
// calibrar percentis reais, ver plano da Fase 3).
const ERROR_SPIKE_THRESHOLD = 50;
const DROP_THRESHOLD = -20;

// Motor de correlação AGREGADA por dia — nunca por sessão individual, porque Sentry e Clarity
// não compartilham um ID de sessão/usuário (confirmado ao planejar esta fase). Cada cenário só
// filtra e apresenta os números que sustentam a etiqueta; quem lê tira a conclusão causal, isto
// aqui não afirma causa e efeito, só descreve o que aconteceu no mesmo dia/período.
//
// Inspirado na taxonomia de cenários (A-H) do pedido original do usuário, adaptado ao que
// realmente dá pra medir com as fontes existentes (Sentry + Clarity, sem GA4/CRM/funil completo).
export function detectScenario(current: DailyPoint, previous: DailyPoint | undefined): Scenario {
	if (!previous) {
		return {
			code: 'H',
			label: 'Sem baseline suficiente',
			description: 'Ainda não há um dia anterior completo para comparar. Precisa de pelo menos 2 dias de digest.',
			evidence: [],
		};
	}

	const errorChange = percentChange(current.sentryOccurrences, previous.sentryOccurrences);
	const sessionsChange = percentChange(current.claritySessions, previous.claritySessions);
	const bookingChange = percentChange(current.bookingArrivals, previous.bookingArrivals);
	const scriptErrorChange = percentChange(current.clarityScriptErrors, previous.clarityScriptErrors);
	const ga4ConversionsChange = percentChange(current.ga4Conversions, previous.ga4Conversions);

	const errorSpiked = errorChange !== null && errorChange >= ERROR_SPIKE_THRESHOLD;
	const scriptErrorSpiked = scriptErrorChange !== null && scriptErrorChange >= ERROR_SPIKE_THRESHOLD;
	const bookingDropped = bookingChange !== null && bookingChange <= DROP_THRESHOLD;
	const sessionsDropped = sessionsChange !== null && sessionsChange <= DROP_THRESHOLD;
	const bookingRose = bookingChange !== null && bookingChange > 0;

	const fmt = (label: string, change: number | null) =>
		change === null ? `${label}: sem dado` : `${label}: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

	const baseEvidence = [
		fmt('Erros Sentry', errorChange),
		fmt('Sessões Clarity', sessionsChange),
		fmt('Chegadas em agendamento', bookingChange),
		fmt('Erros de script (Clarity)', scriptErrorChange),
		fmt('Conversões GA4 (real)', ga4ConversionsChange),
	];

	if (errorSpiked && bookingDropped) {
		return {
			code: 'A',
			label: 'Provável causa técnica',
			description:
				'Erros do Sentry subiram fortemente no mesmo dia em que as chegadas na página de agendamento caíram: correlação temporal agregada, consistente com a hipótese de erro técnico afetando conversão.',
			evidence: baseEvidence,
		};
	}

	if (scriptErrorSpiked && bookingDropped && !errorSpiked) {
		return {
			code: 'G',
			label: 'Possível erro de frontend fora do Sentry',
			description:
				'Erros de script capturados pelo Clarity subiram e as chegadas em agendamento caíram, mas o Sentry não registrou um pico correspondente: sinal de um problema de frontend que o Sentry pode não estar capturando (ex: erro sem instrumentação, bloqueado antes do SDK carregar).',
			evidence: baseEvidence,
		};
	}

	if (bookingDropped && sessionsDropped && !errorSpiked && !scriptErrorSpiked) {
		return {
			code: 'B',
			label: 'Queda por tráfego, não por erro',
			description:
				'Sessões totais e chegadas em agendamento caíram juntas, sem alta de erros: consistente com queda de tráfego geral (sazonalidade, marketing, etc.), não com um problema técnico específico da etapa de agendamento.',
			evidence: baseEvidence,
		};
	}

	if (bookingDropped && !sessionsDropped && !errorSpiked && !scriptErrorSpiked) {
		return {
			code: 'C',
			label: 'Queda concentrada no agendamento',
			description:
				'Chegadas em agendamento caíram mesmo com tráfego geral estável e sem alta de erros: sugere algo específico da etapa/página de agendamento (mudança de layout, oferta, atrito), não um problema técnico geral nem queda de tráfego.',
			evidence: baseEvidence,
		};
	}

	if ((errorSpiked || scriptErrorSpiked) && !bookingDropped) {
		return {
			code: 'D',
			label: 'Erros presentes sem impacto aparente no agendamento',
			description:
				'Houve alta de erros (Sentry e/ou Clarity), mas as chegadas em agendamento não caíram no mesmo dia: os erros existem, mas não há evidência agregada de que estejam afetando essa conversão.',
			evidence: baseEvidence,
		};
	}

	if (bookingRose && !errorSpiked && !scriptErrorSpiked) {
		return {
			code: 'F',
			label: 'Melhora de conversão (proxy)',
			description: 'Chegadas em agendamento subiram sem sinal de erro no mesmo período.',
			evidence: baseEvidence,
		};
	}

	return {
		code: 'E',
		label: 'Comportamento normal',
		description: 'Variações dentro do esperado. Nenhum limiar de erro/queda foi cruzado neste dia.',
		evidence: baseEvidence,
	};
}
