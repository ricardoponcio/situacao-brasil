/** Nomes por extenso das siglas de proposição e a aba do diagrama que explica cada uma. */
export const PROPOSITION_TYPES: Record<string, { name: string; processId?: string }> = {
  PL: { name: 'Projeto de Lei', processId: 'pl' },
  PLP: { name: 'Projeto de Lei Complementar', processId: 'plp' },
  PEC: { name: 'Proposta de Emenda à Constituição', processId: 'pec' },
  MPV: { name: 'Medida Provisória', processId: 'mpv' },
  PLV: { name: 'Projeto de Lei de Conversão (de Medida Provisória)', processId: 'mpv' },
  VET: { name: 'Veto', processId: 'vet' },
  PDL: { name: 'Projeto de Decreto Legislativo' },
  PRC: { name: 'Projeto de Resolução' },
  PRS: { name: 'Projeto de Resolução do Senado' },
  PLN: { name: 'Projeto de Lei do Congresso (orçamento)' },
  REQ: { name: 'Requerimento' },
};

/** Pede para a seção "Como uma lei é feita" abrir na aba de um tipo. */
export const OPEN_PROCESS_EVENT = 'sb:open-process';

export function openProcess(processId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_PROCESS_EVENT, { detail: processId }));
}

/**
 * Ementas costumam começar por "Altera a Lei nº X, de ..., para <objetivo>". O objetivo é a
 * parte que diz o que muda. Extraímos esse trecho literal (sem reescrever o texto oficial).
 */
export function ementaGist(ementa: string): string | null {
  const current = currentEmenta(ementa);
  const m = /^(?:Altera|Acrescenta|Modifica|Revoga|Dá nova redação)[^]*?,\s+para\s+([^]+)$/i.exec(current);
  if (m?.[1]) return `Para ${m[1].trim()}`;
  // Sem o padrão "para ...", mas com ementa nova: mostra só a vigente.
  return current !== ementa.trim() ? current : null;
}

/** Quando o texto foi substituído, a Câmara anexa "NOVA EMENTA: ...". Vale a nova. */
export function currentEmenta(ementa: string): string {
  const parts = ementa.split(/NOVA EMENTA:\s*/i);
  return (parts[parts.length - 1] ?? ementa).trim();
}
