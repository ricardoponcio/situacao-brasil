/** Componentes mínimos, sem conhecimento de dataset específico nem regra de negócio. */
import { useState, type ReactNode } from 'react';
import type { DatasetDescriptor } from '@sb/core';
import type { AsyncState } from '../lib/useAsync.ts';

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

/** "← Política": volta para o nível de cima. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="back" href={href}>
      ← {children}
    </a>
  );
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

/** Botões lado a lado, um escolhido por vez (período do gráfico, abas do assunto). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T | undefined;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={className ? `${className} segmented` : 'segmented'} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface LinkItem {
  url: string;
  label: string;
}

/** Links para fora do site, numa linha. Não mostra nada se não houver links. */
export function ExternalLinks({ links, className = 'feed-links', linkClassName }: { links: LinkItem[]; className?: string; linkClassName?: string }) {
  if (!links.length) return null;
  return (
    <div className={className}>
      {links.map((l) => (
        <a key={l.url} className={linkClassName} href={l.url} target="_blank" rel="noreferrer">
          {l.label}
        </a>
      ))}
    </div>
  );
}

/** Lista com marcadores (cuidados ao ler, limitações, dados de uma fonte). */
export function BulletList({ items }: { items: { key: string; content: ReactNode }[] }) {
  return (
    <ul className="caveats">
      {items.map((i) => (
        <li key={i.key}>{i.content}</li>
      ))}
    </ul>
  );
}

/** Lista de textos com marcadores. */
export const TextList = ({ items }: { items: string[] }) => <BulletList items={items.map((t) => ({ key: t, content: t }))} />;

/** Ficha "rótulo: valor". Linhas com valor vazio (`null`, `undefined`, `false`, `''`) não aparecem. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows
        .filter(([, v]) => v !== null && v !== undefined && v !== false && v !== '')
        .map(([k, v]) => (
          <Fact key={k} label={k}>
            {v}
          </Fact>
        ))}
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** Tabela com rolagem lateral no celular. As linhas vêm prontas. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Bloco recolhível: o conteúdo só é montado (e buscado) quando a pessoa abre. */
export function LazyDetails({ title, intro, children }: { title: string; intro?: string; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="deep" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {intro && <p className="stat-sub">{intro}</p>}
      {open && children()}
    </details>
  );
}
