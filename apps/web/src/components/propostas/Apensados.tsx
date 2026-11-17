/** Projetos apensados: a caixa que liga o agrupamento e a nota "Anda junto com N projetos apensados". */
import { ementaGist } from '../../content/propositionTypes.ts';
import { href } from '../../lib/router.ts';
import { totalApensados, type Group } from '../../controllers/propostas.ts';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** "Agrupar apensados (… 72 projetos em 3 propostas)". */
export function ApensadosToggle({
  checked,
  onChange,
  juntados,
  propostas,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  juntados: number;
  propostas: number;
}) {
  return (
    <label className="feed-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Agrupar apensados{' '}
        <span className="muted">
          (projetos anexados a outro, que andam junto com ele: {juntados.toLocaleString('pt-BR')}{' '}
          {plural(juntados, 'projeto', 'projetos')} em {propostas} {plural(propostas, 'proposta', 'propostas')})
        </span>
      </span>
    </label>
  );
}

/** "Anda junto com 63 projetos apensados", com a lista de cada um. */
export function ApensadosNote({ g }: { g: Group }) {
  const total = totalApensados(g);
  if (!total) return null;
  const semDetalhe = g.apensadosSemDetalhe ?? 0;
  return (
    <details className="vote-more">
      <summary>
        Anda junto com {total === 1 ? '1 projeto apensado' : `${total.toLocaleString('pt-BR')} projetos apensados`}
      </summary>
      <p>Projetos apensados foram anexados a este porque tratam do mesmo assunto. São votados junto com ele.</p>
      <ul className="apensados">
        {(g.apensados ?? []).map((a) => (
          <li key={a.subject.id}>
            {a.subject.ref ? <a href={href.proposta(a.subject.ref)}>{a.subject.label}</a> : a.subject.label}{' '}
            <span className="muted">{ementaGist(a.subject.title) ?? a.subject.title}</span>
          </li>
        ))}
        {semDetalhe > 0 && (
          <li className="muted">
            {semDetalhe === 1 ? 'Mais 1 projeto' : `Mais ${semDetalhe} projetos`} que a Câmara não detalha nos dados
            abertos.
          </li>
        )}
      </ul>
    </details>
  );
}
