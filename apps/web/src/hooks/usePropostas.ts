import { useMemo } from 'react';
import type { Event, PropostaResumo } from '@sb/core';
import { api } from '../lib/api.ts';
import { useAsync, type AsyncState } from '../lib/useAsync.ts';
import { resumosPorRef, vetosPorRef } from '../controllers/propostas.ts';

/** Resumos das propostas, agrupados pela chave (`subject.ref`). Vazio enquanto carrega ou se falhar. */
export function useResumos(refs: string[]): Map<string, PropostaResumo[]> {
  const key = [...new Set(refs)].sort().join(',');
  const state = useAsync(() => api.resumos(key ? key.split(',') : []), [key]);
  return useMemo(() => (state.status === 'ok' ? resumosPorRef(state.data) : new Map()), [state]);
}

const VETOS_DATASET = 'congresso-vetos';

/** Eventos de veto agrupados pelo projeto vetado (`subject.ref`). Só busca quando a lista tem propostas com chave. */
export function useVetosByRef(enabled: boolean): Map<string, Event[]> {
  const state = useAsync(() => (enabled ? api.records(VETOS_DATASET, { limit: 1000 }) : Promise.resolve(null)), [enabled]);
  return useMemo(() => (state.status === 'ok' && state.data ? vetosPorRef(state.data.records) : new Map()), [state]);
}

/** Todos os eventos de uma proposta (Câmara, Senado e vetos), pela chave comum. */
export function useProposta(refKey: string): AsyncState<Event[]> {
  return useAsync(async () => (await api.proposta(refKey)).filter((r): r is Event => r.kind === 'event'), [refKey]);
}
