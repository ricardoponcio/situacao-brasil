import { useEffect, useState } from 'react';
import { OPEN_PROCESS_EVENT } from '../content/propositionTypes.ts';
import { ACTORS, type Actor, type LegislativeProcess, type Step } from '../content/legislativeProcesses.ts';

/** Caminho "mais comum": segue sempre o primeiro caminho de cada etapa até um resultado. */
function mainPath(p: LegislativeProcess): Step[] {
  const byId = new Map(p.steps.map((s) => [s.id, s]));
  const out: Step[] = [];
  let cur: Step | undefined = p.steps[0];
  while (cur && !out.includes(cur)) {
    out.push(cur);
    if (cur.actor === 'resultado') break;
    const next: string | undefined = cur.paths?.[0]?.to;
    cur = next ? byId.get(next) : p.steps[p.steps.indexOf(cur) + 1];
  }
  return out;
}

function ActorChip({ actor }: { actor: Actor }) {
  return <span className={`actor-chip actor-${actor}`}>{ACTORS[actor].label}</span>;
}

/** Diagrama de tramitação: abas por tipo, mapa resumido e etapas com os caminhos possíveis. */
export function ProcessFlow({ processes }: { processes: LegislativeProcess[] }) {
  const [selected, setSelected] = useState(processes[0]!.id);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (processes.some((x) => x.id === id)) setSelected(id);
    };
    window.addEventListener(OPEN_PROCESS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PROCESS_EVENT, onOpen);
  }, [processes]);
  const p = processes.find((x) => x.id === selected) ?? processes[0]!;
  const index = new Map(p.steps.map((s, i) => [s.id, i]));
  const path = mainPath(p);
  const usedActors = [...new Set(p.steps.map((s) => s.actor))];

  // Mapa: etapas do caminho comum, juntando etapas seguidas do mesmo ator
  const map: { actor: Actor; title: string }[] = [];
  for (const s of path) {
    const last = map[map.length - 1];
    if (last && last.actor === s.actor && s.actor !== 'resultado') continue;
    map.push({ actor: s.actor, title: s.actor === 'resultado' ? s.title : ACTORS[s.actor].label });
  }

  const goTo = (stepId: string) => {
    document.getElementById(`step-${p.id}-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(stepId);
    window.setTimeout(() => setFlash((f) => (f === stepId ? null : f)), 1600);
  };

  return (
    <div className="process">
      <div className="process-tabs" role="tablist" aria-label="Tipo de proposta">
        {processes.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={x.id === p.id}
            className={x.id === p.id ? 'active' : ''}
            onClick={() => setSelected(x.id)}
          >
            <strong>{x.sigla}</strong> {x.name}
          </button>
        ))}
      </div>

      <div className="process-head">
        <p className="process-summary">{p.summary}</p>
        <p className="process-quorum">
          <span className="muted">Votos necessários:</span> {p.quorum}
        </p>
      </div>

      <ol className="process-map" aria-label="Caminho mais comum">
        {map.map((m, i) => (
          <li key={i} className={`actor-${m.actor}`}>
            {m.title}
          </li>
        ))}
      </ol>

      <ul className="process-legend" aria-label="Legenda">
        {usedActors.map((a) => (
          <li key={a}>
            <span className={`legend-swatch actor-${a}`} aria-hidden />
            {ACTORS[a].text}
          </li>
        ))}
      </ul>

      <ol className="process-steps">
        {p.steps.map((s, i) => (
          <li
            key={s.id}
            id={`step-${p.id}-${s.id}`}
            className={`step actor-${s.actor} ${flash === s.id ? 'flash' : ''} ${s.actor === 'resultado' ? 'is-result' : ''}`}
          >
            <div className="step-head">
              <span className="step-num">{i + 1}</span>
              <ActorChip actor={s.actor} />
            </div>
            <h4>{s.title}</h4>
            <p>{s.text}</p>
            {s.paths && (
              <ul className="step-paths">
                {s.paths.map((path) => {
                  const target = p.steps[index.get(path.to) ?? -1];
                  return (
                    <li key={path.when}>
                      <span aria-hidden>→</span> {path.when}:{' '}
                      <button className="link" onClick={() => goTo(path.to)}>
                        passo {(index.get(path.to) ?? 0) + 1}: {target?.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {s.detail && (
              <details className="step-detail">
                <summary>Base legal e detalhes</summary>
                <p>{s.detail}</p>
              </details>
            )}
          </li>
        ))}
      </ol>

      <p className="process-source">
        Fonte:{' '}
        <a href={p.legalBasis.url} target="_blank" rel="noreferrer">
          {p.legalBasis.label}
        </a>
        . Mostramos o caminho mais comum, começando pela Câmara; regimes de urgência e ritos especiais ficam de fora.
      </p>
    </div>
  );
}
