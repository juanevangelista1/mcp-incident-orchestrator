'use client';

import { useRef, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { ReportDocument } from '@/lib/report-export/types';

// Usa <dialog> nativo (sem lib de modal): foco/Escape/backdrop já vêm de graça do navegador.
// `buildDocument` é uma função (não o documento pronto) para não montar o ReportDocument em
// toda renderização da página — só quando o usuário realmente abre o modal.
export function ReportExportButton({
	buildDocument,
	filenameBase,
}: {
	buildDocument: () => ReportDocument;
	filenameBase: string;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);
	const [error, setError] = useState('');

	async function handleExport(format: 'pdf' | 'excel') {
		setBusy(format);
		setError('');
		try {
			const doc = buildDocument();
			if (format === 'pdf') {
				const { downloadAsPdf } = await import('@/lib/report-export/to-pdf');
				await downloadAsPdf(doc, filenameBase);
			} else {
				const { downloadAsExcel } = await import('@/lib/report-export/to-excel');
				await downloadAsExcel(doc, filenameBase);
			}
			dialogRef.current?.close();
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Falha ao gerar o relatório.');
		} finally {
			setBusy(null);
		}
	}

	return (
		<>
			<button
				type="button"
				onClick={() => dialogRef.current?.showModal()}
				className="focus-visible:ring-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
			>
				<FileDown className="size-3.5" />
				Exportar relatório
			</button>

			<dialog
				ref={dialogRef}
				className="w-full max-w-sm rounded-lg border bg-card p-0 text-card-foreground backdrop:bg-black/50"
			>
				<div className="flex flex-col gap-4 p-5">
					<div>
						<h2 className="text-sm font-semibold">Exportar relatório</h2>
						<p className="text-muted-foreground text-xs">
							Gera um arquivo com os dados atualmente exibidos nesta página.
						</p>
					</div>

					{error && <p className="text-rose-600 dark:text-rose-400 text-xs">{error}</p>}

					<div className="flex flex-col gap-2">
						<button
							type="button"
							onClick={() => handleExport('pdf')}
							disabled={busy !== null}
							className="focus-visible:ring-ring flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
						>
							{busy === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
							PDF
						</button>
						<button
							type="button"
							onClick={() => handleExport('excel')}
							disabled={busy !== null}
							className="focus-visible:ring-ring flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
						>
							{busy === 'excel' ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<FileSpreadsheet className="size-4" />
							)}
							Excel
						</button>
					</div>

					<button
						type="button"
						onClick={() => dialogRef.current?.close()}
						className="text-muted-foreground self-end text-xs hover:underline"
					>
						Cancelar
					</button>
				</div>
			</dialog>
		</>
	);
}
