import Script from 'next/script';

// gtag.js client-side — distinto da integração GA4 server-side (Ga4Service, via Data API
// com service account) usada pelas tools de MCP. Esse aqui só manda pageviews do dashboard
// para o GA4, não tem relação com os dados que o /insights lê da API.
export function GoogleAnalytics() {
	const measurementId = process.env.NEXT_PUBLIC_MEASUREMENTID;
	if (!measurementId) return null;

	return (
		<>
			<Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy='afterInteractive' />
			<Script id='ga4-init' strategy='afterInteractive'>
				{`
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					gtag('js', new Date());
					gtag('config', '${measurementId}');
				`}
			</Script>
		</>
	);
}
