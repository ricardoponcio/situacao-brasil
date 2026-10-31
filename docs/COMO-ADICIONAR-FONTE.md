# Como adicionar uma fonte

## Caso 1: mais um indicador do IBGE (SIDRA), sem código
1. Ache a tabela e a variável em https://sidra.ibge.gov.br, ou em
   `https://servicodados.ibge.gov.br/api/v3/agregados/<tabela>/metadados`.
2. Acrescente um item em `apps/ingest/src/sources/ibge-sidra/series.ts` com `agregado`, `variavel`, `periodos`,
   `niveis`, `periodType` e o `descriptor` (título, explicação simples **e** técnica, unidade, polaridade, cuidados).
3. `npm run ingest -- ibge-sidra`. Ele aparece sozinho no site.
- Tabelas com classificação (situação do domicílio, tipo de esgoto...): fixe as categorias em `classificacao`, por
  exemplo `1[6795]|825[46285]`. Sem isso, o IBGE devolve uma série por categoria.
- Para somar categorias de uma mesma distribuição (esgoto pela rede = "rede geral" + "fossa ligada à rede"), liste as
  categorias e use `somarCategorias: true`.
- Prefira o percentual de **moradores** (pessoas) ao de domicílios: "de cada 100 pessoas" é mais fácil de ler.

## Caso 2: fonte nova
1. Crie `apps/ingest/src/sources/<id-da-fonte>/index.ts`.
2. Estenda `BaseProcessor`:
   ```ts
   class MinhaFonte extends BaseProcessor {
     constructor() {
       super({ id: 'minha-fonte', name, publisher, homepage, docsUrl, license,
               access: { method: 'api-rest', auth: 'nenhuma' }, publishFrequency: 'mensal',
               coverage: { territorial: ['uf'], temporal: '2010 em diante' },
               limitations: ['...'] }, '0.1.0');
     }
     datasets() { return [this.describe({ id: 'meu-dataset', kind: 'observation', ... })]; }
     protected async *collect(ctx: RunContext) {
       const res = await ctx.http.getJson<Formato>(url);    // arquiva o bruto automaticamente
       for (const item of res.data) yield this.emit('meu-dataset', res.origin, { kind: 'observation', id: ..., ... });
     }
   }
   export default new MinhaFonte();
   ```
3. `npm run ingest -- --list` deve mostrar a fonte. Depois rode `npm run ingest -- minha-fonte`.

## Regras
- **`id` determinístico** a partir da chave natural da origem (por exemplo, `dataset:nivel:codigo:periodo`).
- **Território sempre em código IBGE** (Brasil = `1`, UF = 2 dígitos, município = 7).
- **Explicação simples obrigatória**, escrita para quem tem pouca instrução. Sem adjetivos de juízo ("ótimo", "desastre").
- **Frase-resumo (`summary`)**: escreva o `template` como alguém explicando em voz alta ("De cada 100 pessoas…").
  Use `{sign}`/`{abs}` quando o valor puder ser negativo. `bands` só com referência oficial (meta, limite legal).
  Marque `featured: true` se o dataset deve representar o assunto na página inicial.
- **Leia junto (`readWith`)**: se o número isolado puder ser usado para contar meia verdade, declare o par e o
  porquê. Exemplo: desemprego → subutilização e informalidade. Pergunte-se: "que número a oposição/o governo
  mostraria para rebater este?". Esse número entra como par.
- **Limitações e cuidados**: escreva o que a fonte não mostra. Isso aparece no site.
- Erro em um item: `ctx.issue(...)` e continue. Erro na fonte toda: deixe a exceção subir (a execução vira `error`).
- Nunca contorne bloqueios de acesso (captcha, WAF, anti-robô). Use o canal oficial ou registre o problema no diário.
- Se a fonte for um processador parametrizável (várias tabelas com o mesmo formato), prefira configuração a código.
