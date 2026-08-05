// APM tracing (dd-trace) — plugin opcional, mesmo padrão dos outros services: sem
// DD_AGENT_HOST, o tracer simplesmente não inicializa e o processo roda normalmente,
// só sem enviar traces. Precisa ser importado ANTES dos módulos que devem ser
// auto-instrumentados (ex: node:http em http-server.ts).
import tracer from 'dd-trace';

if (process.env.DD_AGENT_HOST) {
	tracer.init({
		hostname: process.env.DD_AGENT_HOST,
		port: process.env.DD_TRACE_AGENT_PORT ? Number(process.env.DD_TRACE_AGENT_PORT) : undefined,
		service: process.env.DD_SERVICE,
		env: process.env.DD_ENV,
	});
	console.error(
		`[APM] dd-trace inicializado (service=${process.env.DD_SERVICE ?? 'default'}, env=${process.env.DD_ENV ?? 'default'}, agent=${process.env.DD_AGENT_HOST}:${process.env.DD_TRACE_AGENT_PORT ?? '8126'}).`,
	);
} else {
	console.error('[APM] DD_AGENT_HOST não configurado — dd-trace fica de fora.');
}

export default tracer;
