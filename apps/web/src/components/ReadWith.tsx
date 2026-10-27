import type { DatasetDescriptor } from '@sb/core';
import { api } from '../lib/api.ts';
import { href } from '../lib/router.ts';
import { useAsync } from '../lib/useAsync.ts';
import { useSummary } from './summary.tsx';

/** Resolve os "leia junto" de um dataset para descriptors completos. */
export function useCompanions(d: DatasetDescriptor | undefined): DatasetDescriptor[] {
  const all = useAsync(() => api.datasets(), []);
  if (!d || all.status !== 'ok') return [];
  return d.readWith.flatMap((r) => all.data.find((i) => i.descriptor.id === r.datasetId)?.descriptor ?? []);
}

function CompanionItem({ c, why, inPage }: { c: DatasetDescriptor; why: string; inPage: boolean }) {
  const s = useSummary(c);
  const main = s.status === 'ok' ? s.data?.sentences[0] : undefined;
  const value = s.status === 'ok' ? s.data?.value : undefined;
  return (
    <li>
      <a
        href={href.dataset(c.id)}
        onClick={(e) => {
          const el = inPage ? document.getElementById(`ind-${c.id}`) : null;
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      >
        <strong>{c.title}</strong>
        {value && <span className="readwith-value">{value}</span>}
      </a>
      <span className="readwith-why">{why}</span>
      {main && <span className="readwith-main">{main}</span>}
    </li>
  );
}

/**
 * Aviso "leia junto": impede que um número seja lido isolado quando existe outro
 * que muda a interpretação. Aparece logo depois da frase principal.
 */
export function ReadWith({ d, inPage = false }: { d: DatasetDescriptor; inPage?: boolean }) {
  const companions = useCompanions(d);
  if (!companions.length) return null;
  return (
    <aside className="readwith" aria-label="Leia junto">
      <p className="readwith-title">Este número sozinho não conta a história toda. Leia junto:</p>
      <ul>
        {companions.map((c) => (
          <CompanionItem key={c.id} c={c} why={d.readWith.find((r) => r.datasetId === c.id)!.why} inPage={inPage} />
        ))}
      </ul>
    </aside>
  );
}
