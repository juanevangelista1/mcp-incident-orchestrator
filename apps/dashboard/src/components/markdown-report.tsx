import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Todo relatório gerado pelo Gemini (investigação, comparação de rotas, relatório narrativo)
// segue a mesma estrutura Markdown (## Seção, **negrito**, listas). Antes cada tela jogava
// esse texto cru num <article whitespace-pre-wrap>, então "## Sintoma" aparecia literalmente
// na tela e no PDF/Excel em vez de virar um título. Esse componente é o único lugar que
// converte esse Markdown em elementos reais — reaproveitado por IssueInvestigation,
// NarrativeReport e RouteComparisonNarrativeAndExport.
export function MarkdownReport({ text }: { text: string }) {
	return (
		<article
			className="prose prose-sm dark:prose-invert max-w-none
				prose-headings:font-semibold prose-h2:mt-6 prose-h2:mb-2 prose-h2:border-b prose-h2:pb-1
				prose-h2:text-indigo-700 dark:prose-h2:text-indigo-400
				prose-strong:font-semibold prose-li:my-0.5">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
		</article>
	);
}
