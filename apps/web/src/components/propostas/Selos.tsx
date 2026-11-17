/** Selos pequenos das propostas: resultado da votação, quem decidiu e o tipo (PL, PEC…). */
import type { Event } from '@sb/core';
import { Pill, type Tone } from '../ui.tsx';
import { ACTORS } from '../../content/legislativeProcesses.ts';
import { PROPOSITION_TYPES, openProcess } from '../../content/propositionTypes.ts';

const OUTCOME: Record<string, { tone: Tone; icon: string; label: string }> = {
  aprovada: { tone: 'good', icon: '✓', label: 'Aprovada' },
  aprovado: { tone: 'good', icon: '✓', label: 'Aprovado' },
  rejeitada: { tone: 'bad', icon: '✕', label: 'Rejeitada' },
  rejeitado: { tone: 'bad', icon: '✕', label: 'Rejeitado' },
  mantido: { tone: 'neutral', icon: '•', label: 'Veto mantido' },
  derrubado: { tone: 'neutral', icon: '•', label: 'Veto derrubado' },
  'perdeu-validade': { tone: 'neutral', icon: '•', label: 'Perdeu a validade' },
  prejudicada: { tone: 'neutral', icon: '•', label: 'Prejudicada' },
  retirada: { tone: 'neutral', icon: '•', label: 'Retirada' },
  'veto-total': { tone: 'neutral', icon: '•', label: 'Veto total' },
  'veto-parcial': { tone: 'neutral', icon: '•', label: 'Veto parcial' },
  'mantido-em-parte': { tone: 'neutral', icon: '•', label: 'Veto mantido em parte' },
};

export function OutcomePill({ outcome }: { outcome?: string }) {
  if (!outcome) return null;
  const o = OUTCOME[outcome];
  return o ? (
    <Pill tone={o.tone} icon={o.icon}>
      {o.label}
    </Pill>
  ) : (
    <Pill tone="neutral">{outcome}</Pill>
  );
}

export function DecidedByChip({ who }: { who?: Event['decidedBy'] }) {
  return who ? <span className={`actor-chip actor-${who}`}>{ACTORS[who].label}</span> : null;
}

/** Selo cinza com a sigla. Se existir diagrama para o tipo, abre a explicação na aba certa. */
export function TypeBadge({ kind }: { kind: string }) {
  const t = PROPOSITION_TYPES[kind];
  const content = (
    <>
      <strong>{kind}</strong>
      {t && <span className="type-name">{t.name}</span>}
    </>
  );
  if (!t?.processId) return <span className="type-badge">{content}</span>;
  const processId = t.processId;
  return (
    <button className="type-badge" title={`Como funciona: ${t.name}`} onClick={() => openProcess(processId)}>
      {content}
      <span className="type-help" aria-hidden>
        ?
      </span>
    </button>
  );
}
