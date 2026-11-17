/** Controles do gráfico na página do dado: escolha de estados/regiões e as "fichas" das linhas comparadas. */
import { MAX_COMPARE, type Picked } from '../../controllers/series.ts';
import { territoryKey, type TerritoryOption } from '../../lib/territories.ts';

/** Cor da linha do Brasil e das comparadas, na ordem em que entram. Validadas (daltonismo) contra o fundo do cartão. */
export const BRASIL_COLOR = 'var(--series-1)';
export const SLOT_COLORS = ['var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

export interface TerritoryGroup {
  label: string;
  items: TerritoryOption[];
}

/** "Comparar com um estado ou região…": some com os já escolhidos; trava quando está cheio. */
export function ComparePicker({ groups, picked, onPick }: { groups: TerritoryGroup[]; picked: Picked[]; onPick: (t: TerritoryOption) => void }) {
  const pickedKeys = new Set(picked.map((p) => territoryKey(p.t)));
  const full = picked.length >= MAX_COMPARE;
  const pick = (k: string) => {
    const t = groups.flatMap((g) => g.items).find((o) => territoryKey(o) === k);
    if (t && !full) onPick(t);
  };
  return (
    <label className="compare">
      <span className="visually-hidden">Comparar com uma região ou um estado</span>
      <select value="" disabled={full} onChange={(e) => pick(e.currentTarget.value)}>
        <option value="">{full ? `Até ${MAX_COMPARE} ao mesmo tempo` : 'Comparar com um estado ou região…'}</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items
              .filter((o) => !pickedKeys.has(territoryKey(o)))
              .map((o) => (
                <option key={territoryKey(o)} value={territoryKey(o)}>
                  {o.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Brasil fixo e um botão "×" para cada linha comparada. */
export function CompareChips({ picked, onRemove }: { picked: Picked[]; onRemove: (p: Picked) => void }) {
  return (
    <div className="chips" aria-label="Linhas no gráfico">
      <span className="chip static">
        <span className="line-key" style={{ background: BRASIL_COLOR }} aria-hidden />
        Brasil
      </span>
      {picked.map((p) => (
        <button key={territoryKey(p.t)} type="button" className="chip" onClick={() => onRemove(p)} aria-label={`Tirar ${p.t.name} da comparação`}>
          <span className="line-key" style={{ background: SLOT_COLORS[p.slot] }} aria-hidden />
          {p.t.name}
          <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}
