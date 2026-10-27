/** Componentes mínimos, sem conhecimento de dataset específico. */
import { useState, type ReactNode } from 'react';
import type { DatasetDescriptor, Provenance, SourceManifest } from '@sb/core';
import type { AsyncState } from '../lib/useAsync.ts';
import { api } from '../lib/api.ts';
import { formatDateTime, timeAgo } from '../lib/format.ts';
import { href } from '../lib/router.ts';

export function Section({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <article className="card">{children}</article>;
}

/** Explicação em duas camadas: simples sempre visível, técnica sob demanda. */
export function Explain({ explanation, open = false }: { explanation: DatasetDescriptor['explanation']; open?: boolean }) {
  const [show, setShow] = useState(open);
  return (
    <div>
      <p className="explain-simple">{explanation.simple}</p>
      <button className="explain-toggle" onClick={() => setShow((s) => !s)} aria-expanded={show}>
        {show ? 'Esconder explicação técnica' : 'Ver explicação técnica'}
      </button>
      {show && <p className="explain-technical">{explanation.technical}</p>}
    </div>
  );
}

/** Linha de procedência: de onde veio, quando foi coletado, como auditar. */
export function SourceLine({
  descriptor,
  source,
  provenance,
  lastFetchedAt,
}: {
  descriptor: DatasetDescriptor;
  source?: SourceManifest;
  provenance?: Provenance;
  lastFetchedAt?: string | null;
}) {
  const fetched = provenance?.fetchedAt ?? lastFetchedAt ?? undefined;
  return (
    <div className="source-line">
      <span>
        Fonte: <a href={href.source(descriptor.sourceId)}>{source?.publisher ?? descriptor.sourceId}</a>
      </span>
      {fetched && <span title={formatDateTime(fetched)}>Coletado {timeAgo(fetched)}</span>}
      {provenance?.rawHash && (
        <a href={api.rawUrl(provenance.rawHash)} target="_blank" rel="noreferrer">
          Dado bruto
        </a>
      )}
      <a href={href.dataset(descriptor.id)}>Entender e auditar</a>
    </div>
  );
}

export function Async<T>({ state, children }: { state: AsyncState<T>; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return <p className="muted">Carregando…</p>;
  if (state.status === 'error') return <p className="status-error">Não foi possível carregar: {state.error.message}</p>;
  return <>{children(state.data)}</>;
}

export type Tone = 'good' | 'bad' | 'neutral';

export function Pill({ tone, icon, children }: { tone: Tone; icon?: string; children: ReactNode }) {
  return (
    <span className={`pill ${tone === 'neutral' ? '' : tone}`}>
      {icon && <span className="pill-icon" aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
