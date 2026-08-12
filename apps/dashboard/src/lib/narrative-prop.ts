import type { StoredNarrative } from '@/db/schema';
import type { StoredNarrativeProp } from '@/components/narrative-report';

// `getNarrative()` devolve o shape de linha do banco (kind/key/createdAt inclusos); os
// componentes cliente só precisam do texto e dos números suspeitos — pequeno adaptador
// reaproveitado pelas 3 páginas que carregam narrativa persistida (reports, issues/[id],
// issues/comparar).
export function toNarrativeProp(stored: StoredNarrative | null): StoredNarrativeProp | null {
	return stored ? { text: stored.narrative, unverifiedNumbers: stored.unverifiedNumbers } : null;
}
