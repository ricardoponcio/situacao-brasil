/** O que a proposta diz: resumo feito por IA (quando há) e a ementa oficial recolhida. */
import type { PropostaResumo } from '@sb/core';

const CASA: Record<string, string> = { camara: 'da Câmara', senado: 'do Senado' };

/** Descrição simples e o aviso de que foi escrita por IA, com o caminho para o texto oficial. */
export function ResumoIA({ resumo }: { resumo: PropostaResumo }) {
  return (
    <div className="resumo-ia">
      <p className="resumo-descricao">{resumo.descricao}</p>
      <p className="resumo-aviso">
        Resumo feito por inteligência artificial a partir do texto {CASA[resumo.casa] ?? ''}. Pode ter erros: confira o{' '}
        {resumo.textoUrl ? (
          <a href={resumo.textoUrl} target="_blank" rel="noreferrer">
            texto oficial
          </a>
        ) : (
          'texto oficial'
        )}
        .
      </p>
    </div>
  );
}

/** O texto oficial (ementa), recolhido. Só aparece quando a tela já mostrou outra versão (resumo ou ementa curta). */
export function EmentaOficial({ ementa, show }: { ementa: string; show: boolean }) {
  if (!show) return null;
  return (
    <details className="vote-more">
      <summary>Texto oficial (ementa)</summary>
      <p>{ementa}</p>
    </details>
  );
}
