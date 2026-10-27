# Arquitetura

```
 fontes oficiais ──► apps/ingest ──► packages/storage (SQLite + data/raw) ──► apps/api ──► apps/web
 (IBGE, Câmara…)     processadores     registros + catálogo + brutos            só GET       views genéricas
```

## Princípios
1. **Toda entrada vira uma de três DTOs genéricas** (`packages/core/src/records.ts`):
   - `Observation`: valor numérico × período × território × dimensões
   - `Event`: algo que aconteceu (título, data, resultado, atores, links)
   - `Entity`: algo que existe ao longo do tempo (território, pessoa, mandato, órgão)
2. **Proveniência obrigatória** em todo registro: fonte, dataset, processador@versão, URL consultada, hora da coleta
   e hash do bruto.
3. **Documentação é dado** (`packages/core/src/catalog.ts`): `SourceManifest` (a fonte: órgão, licença, acesso,
   limitações) e `DatasetDescriptor` (o dado: explicação simples e técnica, unidade, polaridade, camada, view, cuidados).
4. **O front não conhece datasets.** Ele lê descriptors e escolhe a view pelo `view.type`.
5. **IDs determinísticos**: o mesmo dado de origem sempre gera o mesmo `id`, então recoletar é idempotente (upsert).

## Ingestão (`apps/ingest`)
- `framework/Processor.ts`: interface que o resto do sistema conhece.
- `framework/BaseProcessor.ts`: classe abstrata. Preenche a proveniência, valida contra o zod e descarta e relata
  registros inválidos (a execução fica `partial`).
- `framework/HttpClient.ts`: User-Agent honesto, espaçamento por host, novas tentativas, arquivamento do bruto.
- `framework/registry.ts`: auto-descoberta de `src/sources/*/index.ts`.
- `framework/Runner.ts`: grava catálogo e registros em lotes, e o log de execução em `runs`.
- CLI: `npm run ingest [-- <fonte...>] [--list] [--opt chave=valor]`.

## Armazenamento (`packages/storage`)
Tabelas: `sources`, `datasets`, `records` (payload JSON + colunas extraídas para filtrar), `runs`, `raw_blobs`.
Brutos em `data/raw/<sha256>`. A pasta `data/` fica fora do git e é recriada pela ingestão.

## API (`apps/api`, porta 3101)
| rota | o quê |
|---|---|
| `GET /api/sources` | manifestos + datasets + última execução |
| `GET /api/sources/:id` | idem + histórico de execuções |
| `GET /api/datasets?theme=&layer=` | descriptors + estatísticas |
| `GET /api/datasets/:id` | descriptor + fonte + estatísticas |
| `GET /api/datasets/:id/records?level=&territory=&from=&to=&order=&limit=` | registros de qualquer tipo |
| `GET /api/feed?limit=` | eventos de todas as fontes, mais recentes primeiro |
| `GET /api/raw/:hash[?info]` | resposta bruta exatamente como veio da origem |

## Front (`apps/web`, porta 5173, proxy de /api)
- `views/registry.tsx`: `ViewType → { query(), component }`. `DatasetView` renderiza qualquer dataset.
- Views atuais: `timeseries` (número em destaque + variação em linguagem simples + gráfico), `feed` e `table`.
- `components/ui.tsx`: primitivos (Section, Card, Explain, SourceLine, Pill, Async).
- **Leitura em camadas** (profundidade progressiva):
  1. Início: "O Brasil hoje, em poucas frases" (uma frase por assunto) + cartões de assunto (pergunta, número, tendência)
  2. Assunto (`#/assunto/:id`, definido em `config/topics.ts`, agrupado por `theme`): frase → número → gráfico → explicação
  3. Dado (`#/dados/:id`): frase, gráfico, explicação e cuidados; ficha técnica e auditoria recolhidas
  4. Fontes / Fonte: manifesto, limitações, histórico de coletas
- `lib/summarize.ts`: gera as frases a partir de `descriptor.summary` (template + faixas + comparação com o histórico).
- `components/ReadWith.tsx`: aviso "leia junto" a partir de `descriptor.readWith` (nenhum número aparece sozinho
  quando existe um par que muda a leitura).
- `config/topics.ts` → `modules`: blocos editoriais por assunto. Hoje existe `processo-legislativo`
  (`content/legislativeProcesses.ts` + `components/ProcessFlow.tsx`).
- `lib/api.ts` passa descriptors pelo schema zod do core (os padrões se aplicam a dados gravados por versões antigas).
- `lib/api.ts`: cache em memória por URL (vários componentes pedem os mesmos registros).

## Produção (`brasil.poncio.dev`)
- `docker-compose.yml`: `api` + `ingest` (mesma imagem, `Dockerfile` da raiz) e `web` (nginx, `apps/web/Dockerfile`,
  porta 8090), todos sobre o volume `data`. O `ingest` recoleta tudo a cada `INGEST_INTERVAL` s (padrão 6 h).
- O servidor acompanha a `main` e reconstrói as imagens a cada push. O typecheck roda no build: se falhar, nada muda
  no ar.

## Extensões previstas
- **Processadores derivados** (por exemplo, nota por camada): leem registros do storage e emitem novos registros
  com proveniência apontando para os de origem.
- **Outras views**: mapa (choropleth por UF/município), comparação de territórios, linha do tempo de mandatos.
