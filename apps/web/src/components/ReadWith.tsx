import type { DatasetDescriptor } from '@sb/core';
import { href } from '../lib/router.ts';
import { useCompanions } from '../hooks/useDatasets.ts';
import { useSummaryData } from '../hooks/useSummary.ts';

function CompanionItem({ c, why, inPage }: { c: DatasetDescriptor; why: string; inPage: boolean }) {
  const s = useSummaryData(c);
  const main = s?.sentences[0];
  const value = s?.value;
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
