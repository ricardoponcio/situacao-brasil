/**
 * Transforma os microdados de um arquivo em contagens (sem dado pessoal): município de residência, ano, mês,
 * grupo, faixa de idade e sexo. O que fica no banco é só o número de casos de cada combinação.
 */
import type { DatasusContagem } from '@sb/storage';
import type { Registro } from './dbc.ts';

export type Sistema = 'sim' | 'sinasc' | 'sinan-dengue';

/** Grupos de causa básica da morte (CID-10), pelos capítulos e pelas faixas que o Ministério da Saúde usa. */
export function grupoCausa(cid: string): string {
  const c = cid.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (c.length < 3) return 'ignorada';
  const entre = (a: string, b: string) => c >= a && c <= b;
  // Homicídio: agressões (X85–Y09) e intervenção legal (Y35–Y36), como no Atlas da Violência.
  if (entre('X85', 'Y09') || c === 'Y35' || c === 'Y36') return 'homicidio';
  if (entre('X60', 'X84')) return 'suicidio';
  if (entre('V01', 'V89')) return 'transito';
  if (entre('V90', 'Y98')) return 'outras-externas';
  if (entre('A00', 'B99')) return 'infecciosas';
  if (entre('C00', 'D48')) return 'cancer';
  if (entre('I00', 'I99')) return 'circulatorio';
  if (entre('J00', 'J99')) return 'respiratorio';
  if (entre('P00', 'P96')) return 'perinatal';
  if (entre('R00', 'R99')) return 'mal-definidas';
  return 'outras';
}

/**
 * Idade em anos (frações para bebês). SIM: 3 dígitos, o 1º é a unidade (0 minutos, 1 horas, 2 dias, 3 meses,
 * 4 anos, 5 = 100 anos ou mais). SINAN: 4 dígitos (1 horas, 2 dias, 3 meses, 4 anos).
 */
export function idadeEmAnos(codigo: string, sistema: Sistema): number | null {
  if (!/^\d+$/.test(codigo)) return null;
  const unidade = Number(codigo[0]);
  const n = Number(codigo.slice(1));
  if (sistema === 'sim') {
    if (unidade <= 3) return unidade === 3 ? n / 12 : 0; // menos de 1 ano
    if (unidade === 4) return n;
    if (unidade === 5) return 100 + n;
    return null;
  }
  if (unidade >= 1 && unidade <= 3) return unidade === 3 ? n / 12 : 0;
  if (unidade === 4) return n;
  return null;
}

export function faixa(anos: number | null): string {
  if (anos === null || Number.isNaN(anos)) return 'ignorada';
  if (anos < 1) return 'menos-1';
  if (anos < 5) return '1-4';
  if (anos < 15) return '5-14';
  if (anos < 30) return '15-29';
  if (anos < 60) return '30-59';
  return '60-mais';
}

function sexo(v: string): string {
  if (v === '1' || v === 'M') return 'm';
  if (v === '2' || v === 'F') return 'f';
  return 'i';
}

/** Ano e mês de uma data do DBF: 'ddmmaaaa' (SIM, SINASC) ou 'aaaammdd' (SINAN). */
function anoMes(v: string, formato: 'dmy' | 'ymd'): { ano: number; mes: number } | null {
  if (!/^\d{8}$/.test(v)) return null;
  const [ano, mes] = formato === 'dmy' ? [Number(v.slice(4)), Number(v.slice(2, 4))] : [Number(v.slice(0, 4)), Number(v.slice(4, 6))];
  return mes >= 1 && mes <= 12 ? { ano, mes } : null;
}

export interface Resultado {
  contagens: DatasusContagem[];
  /** Registros lidos e quantos ficaram de fora (dengue descartado). */
  lidos: number;
  ignorados: number;
}

/**
 * Soma os registros de um arquivo, um por vez (o arquivo inteiro nunca fica na memória, só as contagens).
 * `ano` = ano do arquivo, usado quando a data do registro falta.
 * Mortes e nascimentos ficam por ano (mes = 0): com o mês, seriam ~500 mil linhas por ano só de mortes.
 * A dengue fica por mês, porque varia muito ao longo do ano.
 */
export class Agregador {
  private mapa = new Map<string, DatasusContagem>();
  private lidos = 0;
  private ignorados = 0;
  private readonly porMes: boolean;

  constructor(private readonly sistema: Sistema, private readonly ano: number) {
    this.porMes = sistema === 'sinan-dengue';
  }

  somar(r: Registro): void {
    this.lidos++;
    let data: { ano: number; mes: number } | null;
    let mun: string;
    let grupo: string;
    let fx: string;
    let sx: string;
    if (this.sistema === 'sim') {
      data = anoMes(r.valor('DTOBITO'), 'dmy');
      mun = r.valor('CODMUNRES');
      grupo = grupoCausa(r.valor('CAUSABAS'));
      fx = faixa(idadeEmAnos(r.valor('IDADE'), 'sim'));
      sx = sexo(r.valor('SEXO'));
    } else if (this.sistema === 'sinasc') {
      data = anoMes(r.valor('DTNASC'), 'dmy');
      mun = r.valor('CODMUNRES');
      grupo = 'nascido-vivo';
      fx = 'menos-1';
      sx = sexo(r.valor('SEXO'));
    } else {
      // Caso provável de dengue = toda notificação, menos as descartadas (CLASSI_FIN 5), como no boletim do Ministério.
      if (r.valor('CLASSI_FIN') === '5') {
        this.ignorados++;
        return;
      }
      data = anoMes(r.valor('DT_SIN_PRI'), 'ymd');
      mun = r.valor('ID_MN_RESI');
      grupo = 'dengue-provavel';
      fx = faixa(idadeEmAnos(r.valor('NU_IDADE_N'), 'sinan-dengue'));
      sx = sexo(r.valor('CS_SEXO'));
    }
    const municipio = /^\d{6}/.test(mun) ? mun.slice(0, 6) : '';
    const ano = data?.ano ?? this.ano;
    const mes = this.porMes ? (data?.mes ?? 0) : 0;
    const chave = `${ano}|${mes}|${municipio}|${grupo}|${fx}|${sx}`;
    const atual = this.mapa.get(chave);
    if (atual) atual.n++;
    else this.mapa.set(chave, { ano, mes, uf: municipio.slice(0, 2), municipio, grupo, faixa: fx, sexo: sx, n: 1 });
  }

  resultado(): Resultado {
    return { contagens: [...this.mapa.values()], lidos: this.lidos, ignorados: this.ignorados };
  }
}
