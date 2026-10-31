import type { FetchResult } from '../../framework/HttpClient.ts';
import type { RunContext } from '../../framework/Processor.ts';
import type { SenadoProcesso } from './status.ts';

export const SENADO_API = 'https://legis.senado.leg.br/dadosabertos';

/** Página pública da matéria no site do Senado. */
export const senadoPage = (codigoMateria: number) =>
  `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigoMateria}`;

export function getProcesso(ctx: RunContext, id: number): Promise<FetchResult<SenadoProcesso>> {
  return ctx.http.getJson<SenadoProcesso>(`${SENADO_API}/processo/${id}`);
}

/**
 * Acha no Senado uma proposta que veio da Câmara. Projetos de lei e medidas provisórias mantêm sigla, número e
 * ano nas duas Casas; confirmamos pela identificação de origem para não confundir com uma proposta do próprio
 * Senado de mesmo número (PDL e PEC têm numeração separada em cada Casa).
 */
export async function findFromCamara(
  ctx: RunContext,
  sigla: string,
  numero: number,
  ano: number,
): Promise<FetchResult<SenadoProcesso> | undefined> {
  const list = await ctx.http.getJson<{ id: number; casaIdentificadora: string }[]>(
    `${SENADO_API}/processo?sigla=${sigla}&numero=${numero}&ano=${ano}`,
  );
  const origem = `${sigla} ${numero}/${ano}`;
  for (const item of list.data.filter((x) => x.casaIdentificadora === 'SF' || x.casaIdentificadora === 'CN')) {
    const detail = await getProcesso(ctx, item.id);
    const p = detail.data;
    const daCamara = p.siglaCasaIniciadora === 'CD' || (sigla === 'MPV' && p.sigla === 'MPV');
    if (daCamara && (p.identificacaoProcessoInicial ?? p.identificacao) === origem) return detail;
  }
  return undefined;
}
