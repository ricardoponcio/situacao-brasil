/**
 * Catálogo: a documentação de cada fonte e de cada dataset é DADO, não comentário.
 * Ela é validada, gravada no banco e exibida no front (página de auditoria).
 *
 * O front não conhece datasets específicos: ele lê o DatasetDescriptor e escolhe
 * o componente pelo `view.type`. Plugar uma fonte nova = escrever processador + descriptors.
 */
import { z } from 'zod';
import { TerritoryLevel } from './records.ts';

export const Theme = z.enum([
  'economia',
  'trabalho',
  'saude',
  'educacao',
  'seguranca',
  'contas-publicas',
  'politica',
  'territorio',
  'meio-ambiente',
]);
export type Theme = z.infer<typeof Theme>;

/**
 * Camadas inspiradas no Índice de Progresso Social (IPS), que organiza o bem-estar
 * em níveis de necessidade. Datasets de contexto (juros, câmbio, votações) não têm camada.
 */
export const Layer = z.enum(['necessidades-basicas', 'fundamentos-bem-estar', 'oportunidades']);
export type Layer = z.infer<typeof Layer>;

export const Frequency = z.enum(['tempo-real', 'diaria', 'semanal', 'mensal', 'trimestral', 'anual', 'irregular']);
export type Frequency = z.infer<typeof Frequency>;

export const SourceManifest = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  /** Órgão responsável pelo dado */
  publisher: z.string(),
  homepage: z.string().url(),
  docsUrl: z.string().url(),
  license: z.string(),
  access: z.object({
    method: z.enum(['api-rest', 'download', 'scraping']),
    auth: z.enum(['nenhuma', 'chave', 'token']),
    notes: z.string().optional(),
  }),
  /** Com que frequência a ORIGEM publica dados novos */
  publishFrequency: Frequency,
  coverage: z.object({
    territorial: z.array(TerritoryLevel),
    temporal: z.string(),
  }),
  /** Limitações conhecidas, em linguagem clara. Aparecem no front. */
  limitations: z.array(z.string()).default([]),
});
export type SourceManifest = z.infer<typeof SourceManifest>;

export const ViewType = z.enum(['timeseries', 'feed', 'table', 'stat']);
export type ViewType = z.infer<typeof ViewType>;

export const DatasetDescriptor = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  sourceId: z.string(),
  title: z.string(),
  kind: z.enum(['observation', 'event', 'entity']),
  theme: Theme,
  layer: Layer.optional(),
  unit: z.string().optional(),
  /** Casas decimais ao exibir valores */
  decimals: z.number().int().min(0).max(6).default(1),
  frequency: Frequency,
  explanation: z.object({
    /** Para qualquer pessoa: frases curtas, sem jargão. */
    simple: z.string(),
    /** Para quem quer auditar: definição exata, metodologia, unidade. */
    technical: z.string(),
  }),
  /**
   * Direção "boa" do indicador. Usada no futuro pelas notas por camada.
   * neutro = contexto, não se julga (ex.: número de votações).
   */
  polarity: z.enum(['maior-melhor', 'menor-melhor', 'neutro']).default('neutro'),
  view: z.object({
    type: ViewType,
    options: z.record(z.string(), z.unknown()).default({}),
  }),
  caveats: z.array(z.string()).default([]),
  /**
   * Frase-resumo em linguagem simples, montada pelo front a partir do dado mais recente.
   * É a primeira coisa que a pessoa lê: o número vem depois.
   */
  summary: z
    .object({
      /**
       * Marcadores: {value} valor formatado · {round} valor arredondado · {abs} valor absoluto formatado
       * {sign} palavra de direção (signWords) · {period} período mais recente · {count} nº de registros · {subjects} nº de assuntos distintos
       * na janela · {days} tamanho da janela em dias
       */
      template: z.string(),
      /** Contexto factual por faixa de valor (min e max inclusivos; vale a primeira que bater). */
      bands: z
        .array(z.object({ min: z.number().optional(), max: z.number().optional(), text: z.string() }))
        .default([]),
      signWords: z.object({ up: z.string(), down: z.string(), flat: z.string() }).optional(),
      /** Para eventos: janela de contagem em dias. */
      windowDays: z.number().int().positive().optional(),
      /** Compara com o histórico carregado ("menor valor dos últimos N anos"). */
      compareHistory: z.boolean().default(true),
    })
    .optional(),
  /**
   * "Leia junto": indicadores sem os quais este número engana. O site os mostra lado a lado
   * em todas as camadas (frase de abertura, cartão, assunto, página do dado).
   * Ex.: desemprego → subutilização e informalidade.
   */
  readWith: z.array(z.object({ datasetId: z.string(), why: z.string() })).default([]),
  /** Representa o seu assunto no resumo da página inicial. */
  featured: z.boolean().default(false),
  /** Página oficial que descreve este dado específico */
  originDocs: z.string().url().optional(),
});
export type DatasetDescriptor = z.infer<typeof DatasetDescriptor>;
export type DatasetDescriptorInput = z.input<typeof DatasetDescriptor>;
export type SourceManifestInput = z.input<typeof SourceManifest>;
