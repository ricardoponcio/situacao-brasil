/**
 * Identidade de uma proposta legislativa entre fontes. A mesma proposta aparece na Câmara, no Senado e, se
 * vetada, no veto. Todas apontam para a identificação que ela recebeu na Casa onde começou ("PL 2162/2023"),
 * que o Senado publica em `identificacaoProcessoInicial`.
 *
 * A chave vai em `EventSubject.ref` e na URL da página da proposta: "PL-2162-2023".
 */

/** Tipos com numeração separada em cada Casa: "PEC 10/2025" pode ser uma proposta na Câmara e outra no Senado. */
const NUMERACAO_POR_CASA = new Set(['PEC', 'PDL']);

export type Casa = 'CD' | 'SF' | 'CN';

export function propositionRef(sigla: string, numero: number | string, ano: number | string, casa: Casa): string {
  const base = `${sigla}-${Number(numero)}-${ano}`;
  return NUMERACAO_POR_CASA.has(sigla) && casa !== 'CN' ? `${base}-${casa.toLowerCase()}` : base;
}

/** "PL 2162/2023" (como o Senado escreve) → chave. */
export function refFromIdentificacao(identificacao: string, casa: Casa): string | undefined {
  const m = /^([A-Z]+)\s+(\d+)\/(\d{4})$/.exec(identificacao.trim());
  return m ? propositionRef(m[1]!, m[2]!, m[3]!, casa) : undefined;
}

/** Chave → rótulo para leitura: "PL 2.162/2023", "PEC 10/2025 (Senado)". */
export function refLabel(ref: string): string {
  const [sigla, numero, ano, casa] = ref.split('-');
  const casaLabel = casa === 'cd' ? ' (Câmara)' : casa === 'sf' ? ' (Senado)' : '';
  return `${sigla} ${Number(numero).toLocaleString('pt-BR')}/${ano}${casaLabel}`;
}
