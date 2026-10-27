import type { DatasetDescriptor } from '@sb/core';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { RunContext } from '../../framework/Processor.ts';

const API = 'https://servicodados.ibge.gov.br/api/v1/localidades';

interface Regiao { id: number; sigla: string; nome: string }
interface Estado { id: number; sigla: string; nome: string; regiao: Regiao }
interface Municipio {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: Estado } } | null;
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: Estado } } | null;
}

/**
 * Lista oficial de UFs e municípios. É a "tabela de referência" que liga todas as
 * outras fontes: o código IBGE do território.
 */
class IbgeLocalidadesProcessor extends BaseProcessor {
  constructor() {
    super(
      {
        id: 'ibge-localidades',
        name: 'IBGE – Localidades',
        publisher: 'Instituto Brasileiro de Geografia e Estatística (IBGE)',
        homepage: 'https://www.ibge.gov.br/geociencias/organizacao-do-territorio.html',
        docsUrl: 'https://servicodados.ibge.gov.br/api/docs/localidades',
        license: 'Dados públicos; uso livre com citação da fonte (IBGE).',
        access: { method: 'api-rest', auth: 'nenhuma' },
        publishFrequency: 'irregular',
        coverage: { territorial: ['pais', 'regiao', 'uf', 'municipio'], temporal: 'Divisão territorial vigente.' },
        limitations: ['Mostra só a divisão atual; municípios criados ou extintos no passado não aparecem com histórico.'],
      },
      '0.1.0',
    );
  }

  datasets(): DatasetDescriptor[] {
    return [
      this.describe({
        id: 'territorios-uf',
        title: 'Estados e Distrito Federal',
        kind: 'entity',
        theme: 'territorio',
        frequency: 'irregular',
        explanation: {
          simple: 'Os 26 estados e o Distrito Federal, com o código oficial que o IBGE usa para cada um.',
          technical: 'Endpoint /localidades/estados. O código de 2 dígitos é a chave usada para cruzar dados por UF.',
        },
        view: { type: 'table', options: { columns: ['sigla', 'regiao'] } },
      }),
      this.describe({
        id: 'territorios-municipio',
        title: 'Municípios',
        kind: 'entity',
        theme: 'territorio',
        frequency: 'irregular',
        explanation: {
          simple: 'Todos os municípios do Brasil, com o código oficial do IBGE.',
          technical:
            'Endpoint /localidades/municipios. O código de 7 dígitos é a chave usada por TSE, DATASUS, INEP, Tesouro (SICONFI) e outros.',
        },
        view: { type: 'table', options: { columns: ['uf'], pageSize: 50 } },
      }),
    ];
  }

  protected async *collect(ctx: RunContext): AsyncIterable<Emission> {
    const estados = await ctx.http.getJson<Estado[]>(`${API}/estados?orderBy=nome`);
    for (const e of estados.data) {
      yield this.emit('territorios-uf', estados.origin, {
        kind: 'entity',
        id: `territorio:uf:${e.id}`,
        entityType: 'territorio',
        name: e.nome,
        territory: { level: 'uf', code: String(e.id), name: e.nome },
        attributes: { sigla: e.sigla, regiao: e.regiao.nome },
      });
    }
    ctx.log(`${estados.data.length} UFs`);

    const municipios = await ctx.http.getJson<Municipio[]>(`${API}/municipios?orderBy=nome`, { timeoutMs: 120_000 });
    for (const m of municipios.data) {
      const uf = m.microrregiao?.mesorregiao?.UF ?? m['regiao-imediata']?.['regiao-intermediaria']?.UF;
      if (!uf) ctx.issue(`município ${m.id} (${m.nome}) sem UF na resposta`);
      yield this.emit('territorios-municipio', municipios.origin, {
        kind: 'entity',
        id: `territorio:municipio:${m.id}`,
        entityType: 'territorio',
        name: m.nome,
        territory: { level: 'municipio', code: String(m.id), name: m.nome },
        attributes: { uf: uf?.sigla ?? null, codigoUf: uf?.id ?? null },
      });
    }
    ctx.log(`${municipios.data.length} municípios`);
  }
}

export default new IbgeLocalidadesProcessor();
