/**
 * População por ano (Brasil, regiões, estados) para as taxas. Fonte: IBGE.
 *  - Estimativas anuais, tabela SIDRA 6579 (não há 2007, 2010, 2022 e 2023).
 *  - 2022: Censo, tabela 4709.
 *  - Anos que faltam: crescimento constante entre os dois anos vizinhos; depois do último, repete o último.
 */
import type { Origin } from '../../framework/HttpClient.ts';
import type { RunContext } from '../../framework/Processor.ts';

const API = 'https://servicodados.ibge.gov.br/api/v3/agregados';
const NIVEIS: Record<string, 'pais' | 'regiao' | 'uf'> = { N1: 'pais', N2: 'regiao', N3: 'uf' };

interface SidraVar {
  resultados: { series: { localidade: { id: string; nome: string; nivel: { id: string } }; serie: Record<string, string> }[] }[];
}

export interface Populacao {
  /** Pessoas no território (nível:código) no ano; null se não houver como estimar. */
  de(level: string, code: string, ano: number): number | null;
  nome(level: string, code: string): string | undefined;
  /** Anos com número calculado, e não publicado pelo IBGE (para os avisos). */
  calculados: Set<number>;
  origem: Origin;
}

export async function carregarPopulacao(ctx: RunContext, anos: number[]): Promise<Populacao> {
  const localidades = 'N1[all]|N2[all]|N3[all]';
  const periodos = await ctx.http.getJson<{ id: string }[]>(`${API}/6579/periodos`);
  const disponiveis = periodos.data.map((p) => p.id).filter((a) => Number(a) >= Math.min(...anos) - 2);
  const est = await ctx.http.getJson<SidraVar[]>(
    `${API}/6579/periodos/${disponiveis.join('|')}/variaveis/9324?localidades=${encodeURIComponent(localidades)}`,
  );
  const censo = await ctx.http.getJson<SidraVar[]>(
    `${API}/4709/periodos/2022/variaveis/93?localidades=${encodeURIComponent(localidades)}`,
  );

  const valores = new Map<string, Map<number, number>>(); // "nivel:codigo" → ano → pessoas
  const nomes = new Map<string, string>();
  for (const res of [est.data, censo.data])
    for (const v of res)
      for (const r of v.resultados)
        for (const s of r.series) {
          const level = NIVEIS[s.localidade.nivel.id];
          if (!level) continue;
          const chave = `${level}:${s.localidade.id}`;
          nomes.set(chave, s.localidade.nome);
          const m = valores.get(chave) ?? new Map<number, number>();
          for (const [ano, txt] of Object.entries(s.serie)) {
            const n = Number(txt);
            if (Number.isFinite(n) && n > 0) m.set(Number(ano), n);
          }
          valores.set(chave, m);
        }

  const calculados = new Set<number>();
  const de = (level: string, code: string, ano: number): number | null => {
    const m = valores.get(`${level}:${code}`);
    if (!m) return null;
    const exato = m.get(ano);
    if (exato) return exato;
    const anosConhecidos = [...m.keys()].sort((a, b) => a - b);
    const antes = anosConhecidos.filter((a) => a < ano).at(-1);
    const depois = anosConhecidos.find((a) => a > ano);
    calculados.add(ano);
    if (antes !== undefined && depois !== undefined) {
      const p0 = m.get(antes)!;
      const p1 = m.get(depois)!;
      return Math.round(p0 * (p1 / p0) ** ((ano - antes) / (depois - antes)));
    }
    if (antes !== undefined) return m.get(antes)!;
    return null;
  };

  return { de, nome: (l, c) => nomes.get(`${l}:${c}`), calculados, origem: est.origin };
}
