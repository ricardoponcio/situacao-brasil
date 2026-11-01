import { useMemo } from 'react';
import type { PropostaResumo } from '@sb/core';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';

/** Resumos das propostas, agrupados pela chave (`subject.ref`). Vazio enquanto carrega ou se falhar. */
export function useResumos(refs: string[]): Map<string, PropostaResumo[]> {
  const key = [...new Set(refs)].sort().join(',');
  const state = useAsync(() => api.resumos(key ? key.split(',') : []), [key]);
  return useMemo(() => {
    const map = new Map<string, PropostaResumo[]>();
    if (state.status !== 'ok') return map;
    for (const r of state.data) map.set(r.ref, [...(map.get(r.ref) ?? []), r]);
    return map;
  }, [state]);
}

/** A versão do texto da Casa pedida (o texto muda de uma Casa para a outra); se não houver, a mais recente. */
export function pickResumo(list: PropostaResumo[] | undefined, casa?: string): PropostaResumo | undefined {
  return list?.find((r) => r.casa === casa) ?? list?.[0];
}

/** Casa do assunto, pelo prefixo do id ("camara-proposicao:123"). */
export function casaOf(subjectId: string): string | undefined {
  const prefix = subjectId.split(':')[0];
  return prefix === 'camara-proposicao' ? 'camara' : prefix === 'senado-processo' ? 'senado' : undefined;
}

const CASA: Record<string, string> = { camara: 'da Câmara', senado: 'do Senado' };

/** Descrição simples e o aviso de que foi escrita por IA, com o caminho para o texto oficial. */
export function ResumoIA({ resumo }: { resumo: PropostaResumo }) {
  return (
    <div className="resumo-ia">
      <p className="resumo-descricao">{resumo.descricao}</p>
      <p className="resumo-aviso">
        Resumo feito por inteligência artificial a partir do texto {CASA[resumo.casa] ?? ''}. Pode ter erros: confira o{' '}
        {resumo.textoUrl ? (
          <a href={resumo.textoUrl} target="_blank" rel="noreferrer">
            texto oficial
          </a>
        ) : (
          'texto oficial'
        )}
        .
      </p>
    </div>
  );
}
