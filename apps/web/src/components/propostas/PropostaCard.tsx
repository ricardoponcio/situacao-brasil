import type { Event, PropostaResumo } from '@sb/core';
import { refLabel } from '@sb/core';
import { ementaGist } from '../../content/propositionTypes.ts';
import { formatDate } from '../../lib/format.ts';
import { href } from '../../lib/router.ts';
import { SUBJECT_SITE, casaOf, isVeto, latestStatus, pickResumo, type Group } from '../../controllers/propostas.ts';
import { SubjectProgress, VetoNote } from './Andamento.tsx';
import { ApensadosNote } from './Apensados.tsx';
import { EmentaOficial, ResumoIA } from './Resumo.tsx';
import { TypeBadge } from './Selos.tsx';

/** Uma proposta na lista: o resumo e onde está. Votações e tramitação ficam na página de detalhes. */
export function PropostaCard({ g, vetos, resumos }: { g: Group; vetos?: Event[]; resumos?: PropostaResumo[] }) {
  const last = g.events[0]!;
  const ref = g.subject.ref;
  const veto = isVeto(g.subject);
  const gist = ementaGist(g.subject.title);
  // Num veto, o resumo seria do projeto vetado, não do veto: fica para a página da proposta.
  const resumo = veto ? undefined : pickResumo(resumos, casaOf(g.subject.id));
  const status = latestStatus(g.events);
  return (
    <li className={`vote-group actor-${status?.now.where ?? last.decidedBy ?? 'proponente'}`}>
      <div className="vote-meta">
        <TypeBadge kind={g.subject.kind} />
        <span className="muted">{g.subject.label}</span>
        {veto && ref && (
          <span>
            Projeto vetado: <a href={href.proposta(ref)}>{refLabel(ref)}</a>
          </span>
        )}
        <time className="vote-date" dateTime={last.occurredAt}>
          Última movimentação: {formatDate(last.occurredAt.slice(0, 10))}
        </time>
      </div>
      <p className="vote-title">{resumo?.titulo ?? gist ?? g.subject.title}</p>
      {resumo && <ResumoIA resumo={resumo} />}
      {status && <SubjectProgress status={status} />}
      {!veto && vetos && <VetoNote events={vetos} />}
      <ApensadosNote g={g} />
      <EmentaOficial ementa={g.subject.title} show={!!(gist || resumo)} />
      <div className="vote-links">
        {ref ? (
          <a className="vote-link" href={href.proposta(ref)}>
            Ver detalhes
          </a>
        ) : (
          g.subject.url && (
            <a className="vote-link" href={g.subject.url} target="_blank" rel="noreferrer">
              {SUBJECT_SITE[g.subject.id.split(':')[0]!] ?? 'Tramitação completa'}
            </a>
          )
        )}
      </div>
    </li>
  );
}
