# Diário do projeto

Registro cronológico de decisões, motivos e estado. **Entradas novas vão no topo.**
Serve para (1) retomar contexto depois de um clear de sessão e (2) mostrar no futuro o caminho tomado.

Formato de cada entrada: data · o que foi feito · decisões (com o porquê) · problemas em aberto · próximos passos.

---

## 2026-10-30 · Sessão 8: levantamento de fontes para ampliar a coleta

### O que foi feito
- Pedido do autor: buscar todas as fontes possíveis. Resultado em `docs/FONTES-CANDIDATAS.md`, com prioridade,
  acesso, endereço e assunto de cada uma.
- Cerca de 50 endereços **testados de verdade** (de conexão no Brasil), não tirados só da documentação.

### Achados
- **O Banco Central voltou a responder** (SGS e Olinda/Focus). Na sessão 1 recusava. O bloqueio de antes era
  provavelmente de rede, e o servidor já sai por um proxy no Brasil.
- **Senado tem API aberta e completa** (votações, situação atual das matérias, vetos). É a continuação natural da
  sessão 7.
- **SIDRA tem as tabelas da camada 1** (segurança alimentar 9552, água 6731, esgoto 7192, falta d'água 7190) e de
  desigualdade (Gini 7435). Entram só com configuração.
- Saíram do ar ou mudaram: API do Atlas da Violência, CKAN do OpenDataSUS, painel do TerraBrasilis; o PDET (CAGED)
  não abre conexão.
- Portal da Transparência, dados.gov.br e DataJud pedem chave gratuita: decisão do autor (criar as contas).
- MapBiomas e SEEG bloquearam acesso automático e não são órgãos públicos: ficam de fora, pela regra do projeto.

### Próximos passos
Seguir a "Ordem sugerida" do documento: tabelas do SIDRA da camada 1 → Senado → Banco Central → calendário do IBGE.

---

## 2026-10-30 · Sessão 7: "agora" e "próximo passo" de cada proposta votada

### Pedido do autor
"Aprovada" na lista da Câmara não dizia se a proposta estava aprovada de verdade ou se ainda faltava, por exemplo, o
Senado. Pedido: mostrar o passo atual e o próximo.

### O que se viu nos dados
- Das 14 propostas da coleta anterior, **5 marcadas "Aprovada" continuavam paradas em comissões da Câmara**: o que
  tinha sido aprovado era só um pedido de urgência. Outras já estavam no Senado, uma com o Presidente e uma já tinha
  virado lei.
- A API da Câmara informa a situação atual (`/proposicoes/{id}` → `statusProposicao`: código, texto oficial, órgão,
  data). O destino depois do Plenário aparece no despacho "A matéria vai ao Senado Federal / à sanção / à
  promulgação" (`/proposicoes/{id}/tramitacoes`). A situação sozinha às vezes não basta: o PL 1.435/2023 aparece
  como "Aguardando Autógrafos na Mesa", mas o despacho diz que ele vai à sanção.
- O campo `descricaoSituacao` de cada tramitação antiga não é histórico (vem com a situação de agora); por isso só
  o texto do despacho é usado.

### O que foi feito
- **Contrato** (`packages/core/src/records.ts`): `EventSubject.status` com `now` e `next` (`SubjectStage`: texto
  simples, `where` = Câmara/Senado/Congresso/Presidência/resultado, e `step` = id da etapa no diagrama), `done` e
  `official` (o texto da origem, sem reescrever). Serve para o Senado quando ele entrar.
- **Coleta da Câmara** (versão 0.2.0): busca a situação e as tramitações uma vez por proposição em cada execução.
  `camara-votacoes/status.ts` traduz o código de situação em "agora/próximo" (arquivada, virou lei, no Senado, com o
  Presidente, pronta para o Plenário, em comissão...). Se a consulta falhar, a votação segue sem a situação.
- **Lista**: cada proposta mostra "Agora" e "Próximo passo" com o selo de quem cuida. A barra lateral passou a ter a
  cor de **onde a proposta está agora** (antes: quem fez a última votação). Votação de requerimento ganhou o aviso
  "(um pedido sobre o andamento, não o texto)".

### Decisões
- A tradução fica **na coleta** e o front só exibe: é a regra das DTOs genéricas (o front não conhece a Câmara).
- Simplificação assumida, igual à do diagrama: "Senado vota; se mudar o texto, volta para a Câmara". Para projetos que
  começaram no Senado e voltam para lá, o "se mudar" não se aplica; o texto oficial continua disponível.
- Depois que vai ao Senado, a Câmara só atualiza a situação quando o texto volta ou vira lei. Isso está nas
  limitações da fonte. A coleta do Senado resolve.

### Verificado
- Coleta: 39 registros, 0 problemas. typecheck, `ingest --list` e build ok. Tela no desktop e a 375 px (Chrome
  headless) sem rolagem horizontal.

### Próximos passos
1. Clicar no passo e abrir o diagrama já na etapa (`step` já vem no dado).
2. Senado: votações e situação das propostas que saíram da Câmara.
3. Itens anteriores: significância estatística nas variações da PNAD; camada 1 (necessidades básicas).

---

## 2026-10-30 · Sessão 6: 502 em /api no ar e coleta do IBGE no servidor

### O que foi feito
- `/api/*` dava 502 desde 28/10. Causa: a parada noturna do backup reinicia `api` e `ingest`, e os dois voltaram com
  IPs trocados. O nginx do `web` só resolve o nome `api` quando sobe, então seguiu mandando para o IP antigo (agora do
  `ingest`), que recusa a conexão.
- `apps/web/nginx/default.conf`: `resolver 127.0.0.11` (DNS do Docker) e `proxy_pass` com variável, para resolver
  `api` a cada requisição. Testado localmente recriando a API com outro IP.
- No ar, reiniciar o `web` resolveu na hora; o ajuste evita que volte.

- **Coleta do IBGE falhava no ar** (`fetch failed` = `UND_ERR_CONNECT_TIMEOUT`). O `servicodados.ibge.gov.br` não
  aceita conexão do servidor (fora do Brasil): nem abre o TCP, com ou sem IPv6. De conexão no Brasil responde na hora.
  A Câmara funciona de qualquer lugar.
- `docker-compose.yml`: `INGEST_HTTPS_PROXY` opcional no `ingest` (vira `HTTPS_PROXY` + `NODE_USE_ENV_PROXY=1`, que o
  `fetch` do Node 24 entende sem dependência nova). No ar, aponta para um proxy de saída num servidor nosso no
  Brasil, liberado só para domínios `gov.br`/`leg.br`. Depois disso: IBGE localidades 5598 registros, SIDRA 600, 0
  problemas.

### Decisões
- **Proxy de saída não é "contornar bloqueio"** no sentido do `CLAUDE.md`: a regra existe para não depender de truque
  que a fonte possa fechar a qualquer momento (retrabalho a cada correção do lado deles). Aqui a requisição sai de
  verdade de uma máquina nossa no Brasil, com o User-Agent honesto do projeto, como sairia de qualquer usuário daqui.
  Proxy comercial, rodízio de IP ou disfarce de navegador continuam proibidos.
- Todas as fontes da coleta passam pelo proxy quando ele está ligado (são todas brasileiras); se entrar fonte de fora,
  rever (`NO_PROXY`).

---

## 2026-10-27 · Sessão 5: publicação em brasil.poncio.dev com deploy a cada push

### O que foi feito
- **`Dockerfile` único com estágios**: `deps` (um `npm ci` só) → `check` (typecheck + build do front) → alvo `node`
  (API e coleta, só dependências de produção, TypeScript direto pelo tsx) e alvo `web` (nginx com
  `apps/web/nginx/default.conf`, que repassa `/api/` para a API). O `tsx` passou a ser dependência de `@sb/api` e
  `@sb/ingest`, porque roda em produção.
- **`docker-compose.yml`**: `api`, `ingest` e `web` (porta 8090) sobre o volume `data` (`SB_DATA_DIR=/data`).
  O `ingest` coleta todas as fontes ao subir e depois a cada `INGEST_INTERVAL` segundos (padrão 6 h). Isso cumpre o
  "agendar a coleta" dos próximos passos.
- O servidor acompanha a `main` e reconstrói as imagens quando o commit muda: um push aparece no ar em poucos minutos.

### Decisões
- **Build leve para servidor pequeno (1 GB)**: a primeira versão tinha dois Dockerfiles, e o mesmo `npm ci` rodava duas
  vezes em paralelo, com a imagem Node gravada duas vezes (api e ingest). Agora as dependências são instaladas uma
  vez, só a `api` constrói a imagem e o `ingest` a reaproveita (`pull_policy: never`).
- **typecheck dentro do build** da imagem da API: se falhar, o build falha e o container antigo continua no ar.
- **index.html sem cache, `/assets/` com cache longo**: o deploy novo aparece na hora, sem baixar tudo de novo.
- **O volume `data` entra no backup.** O banco se refaz coletando de novo, mas os brutos (`data/raw`) são a trilha
  de auditoria, e a fonte pode mudar ou tirar o dado do ar.

### Verificado
- Build e subida locais: front, `/api/sources`, `/api/feed` e a coleta (Câmara, IBGE) ok. typecheck ok.
- Um erro de tipo proposital faz o build falhar (`failed to solve`), sem trocar nada.

### Próximos passos
1. Conferir `https://brasil.poncio.dev` depois do primeiro deploy.
2. Continuar a lista de próximos passos da sessão 3 (o item "agendar a coleta" está feito).

---

## 2026-10-26 · Sessão 4: votações legíveis e "como funciona" recolhido

### Feedback do autor
- A explicação de como uma lei é feita pesa demais logo de cara: ela deve ficar num accordion.
- Na lista de votações não dava para saber o que era PEC, PLP ou PL, e faltava cor.

### Decisão do autor sobre cores (perguntado explicitamente)
- **Cor = quem decide** (Câmara verde-água, Senado azul, Congresso as duas cores, Presidência laranja), na página
  inteira. O **tipo** (PL, PEC, MPV…) é um **selo cinza escrito**, sem cor própria, para não ter duas regras de cor
  brigando na mesma página.
- Na lista, cada proposta leva a barra da cor de quem votou. Hoje tudo é verde-água (Plenário da Câmara); quando o
  Senado entrar, aparecerá em azul. A cor da lista e a do diagrama significam a mesma coisa.

### O que foi feito
- **Contrato de eventos**: `Event.subject` (assunto: id, tipo, rótulo, ementa, url) e `Event.decidedBy` viraram
  campos oficiais e validados. Isso serve para qualquer fonte futura (Senado, Congresso, DOU).
- **Coleta da Câmara**: busca o detalhe de cada votação (`/votacoes/{id}` → `proposicoesAfetadas[0]`) para obter a
  proposição principal e a ementa. Votações de requerimento recebem `category: 'procedimento'`. A proveniência
  aponta para o detalhe, que é de onde vem a ementa.
- **Lista agrupada por proposta** (`view.options.groupBySubject`): o título é a ementa. Quando a ementa é
  "Altera a Lei X, para <objetivo>", mostramos só "Para <objetivo>" (trecho literal, sem reescrever) e a ementa
  completa fica recolhida. Quando há "NOVA EMENTA:", vale a nova. As votações técnicas ficam recolhidas dentro
  da proposta.
- **Selo do tipo** ("PL Projeto de Lei ?"): o clique abre o accordion "Como uma lei é feita" já na aba do tipo
  (evento `sb:open-process`).
- **Accordion**: os módulos de assunto ficam recolhidos por padrão.
- Frase de abertura: "votou 14 propostas, em 23 votações". O número em destaque passa a ser de propostas
  (marcador `{subjects}`).

### Verificado
- Desktop e celular (375 px, sem rolagem horizontal). O clique no selo MPV abre a aba certa. typecheck e build ok.

### Problemas em aberto
- "Última votação: Aprovada" pode enganar: aprovar uma emenda não é aprovar o projeto. Próximo passo: distinguir
  a votação do texto principal ou da redação final ("aprovado na Câmara, segue para o Senado") das votações
  acessórias, usando a tramitação (`/proposicoes/{id}/tramitacoes`) e ligando ao passo do diagrama.
- Os tipos sem diagrama (PDL, PRC, REQ) aparecem como selo sem explicação.

---

## 2026-10-26 · Sessão 3: contra o viés ("leia junto") e o caminho das leis

### Princípio novo: nenhum número sozinho
Ponto levantado pelo autor: a taxa de desemprego sem a de subutilização gera viés populista (cada lado destaca o
que lhe convém). Isso virou **regra do projeto**: quando existe um indicador que muda a leitura de outro, os dois
aparecem juntos em todas as camadas.
- `DatasetDescriptor.readWith: [{ datasetId, why }]`. O front mostra:
  - na abertura: a frase do primeiro par entra na mesma linha ("5 em 100 não encontram… somando…, são 13 em 100");
  - no cartão do assunto: o valor dos pares abaixo do número principal;
  - no assunto e no dado: o aviso "Este número sozinho não conta a história toda. Leia junto:", com o porquê.
- A CLI avisa se algum `readWith` aponta para um dataset inexistente.
- Datasets novos (SIDRA, trimestre móvel): **subutilização** (6441/4118) e **informalidade** (8513/12466).
- Pares futuros previstos: inflação ↔ renda real; PIB ↔ PIB per capita; homicídios em números absolutos ↔ taxa por 100 mil.

### Diagramas do processo legislativo
- Pedido do autor: mostrar como nascem e para onde vão PL, PEC, MP etc., com cores por classificação.
- Interpretação adotada: **cor = quem decide em cada etapa** (Câmara, Senado, Congresso em conjunto, Presidência),
  com uma aba por tipo (PL, PLP, PEC, MPV, VET).
- Cores validadas com o validador de paleta (dataviz): 4 cores não passam juntas em todos os modos (violeta e azul se
  confundem no escuro). Solução: 3 cores (Câmara verde-água, Senado azul, Presidência laranja). **Congresso = as duas
  cores juntas** (barra metade verde-água, metade azul), o que é fiel: são as duas Casas. Quem propõe e os resultados
  ficam em cinza neutro (resultado não é bom nem ruim). A cor nunca está sozinha: o nome da instituição aparece escrito.
- Conteúdo como dado: `apps/web/src/content/legislativeProcesses.ts`, com etapas, caminhos ("se aprovar → passo N")
  e base legal (artigos da CF) em cada etapa. Componente genérico `ProcessFlow`, com mapa do caminho mais comum,
  legenda e etapas.
- Os assuntos ganharam `modules` (blocos editoriais que não vêm de dataset). Política usa `processo-legislativo`,
  posicionado **antes** das votações, porque dá o vocabulário para entendê-las.
- Simplificações declaradas na própria página: caminho começando pela Câmara, sem urgência nem ritos especiais.
- **Pendente: revisão do conteúdo jurídico por alguém da área** antes de qualquer divulgação.

### Problema encontrado e corrigido
- A página ficou em branco: o descriptor da Câmara no banco era anterior ao campo `readWith`. Correção estrutural:
  o front passa todo descriptor pelo schema zod do core (`api.ts`), então campos novos ganham o valor padrão mesmo
  com o banco no formato antigo.

### Ideia anotada (importante)
- O IBGE publica, para as taxas da PNAD, se cada variação é **estatisticamente significativa** (variáveis "Situação
  da variação", por exemplo 8662/8666 na tabela 6441). Usar isso no indicador de variação, com textos como "Estável
  (dentro da margem de erro)" em vez de "Caiu 0,1 ponto". É outra defesa contra a leitura enviesada.

### Próximos passos
1. Variação com significância estatística (ideia acima).
2. Ligar as votações aos diagramas: cada votação mostra o tipo (PL/PEC/MPV…) e "em que passo está" (precisa de
   `/proposicoes/{id}` e da tramitação na API da Câmara). Agrupar votações por proposição, com ementa.
3. Camada 1 (necessidades básicas), agendamento da coleta, commit inicial.

---

## 2026-10-26 · Sessão 2: leitura em camadas (UX)

### Feedback do autor
"Parece dados jogados." A home abria com uma parede de votações em juridiquês antes de a pessoa saber do que o site
trata. Pedido: aliviar o impacto inicial, deixar a pessoa ir digerindo, agrupar no começo e aprofundar aos poucos.

### Decisão: profundidade progressiva, como uma notícia
1. **Home, "O Brasil hoje, em poucas frases"**: uma frase por assunto, em português comum, gerada dos dados. Sem gráfico.
2. **Home, "Escolha um assunto"**: cartões com **perguntas** ("Os preços estão subindo muito?"), um número, uma
   mini-tendência e o link. Assuntos sem dados aparecem como "Em breve".
3. **Página do assunto** (`#/assunto/:id`): cada indicador com frase → número → gráfico → explicação simples.
4. **Página do dado**: frase e gráfico no topo. Ficha técnica e auditoria ficam **recolhidas** (e só são buscadas
   quando a pessoa abre).
- As camadas do IPS e o motivo de não ter nota única foram para um bloco recolhível "Como este site organiza…".

### Como ficou plugável
- `DatasetDescriptor.summary`: `template` com marcadores ({value}, {abs}, {sign}, {round}, {period}, {count}, {days}),
  `bands` (contexto factual por faixa de valor), `signWords`, `windowDays` e `compareHistory`.
- `DatasetDescriptor.featured`: o dataset que representa o assunto na home.
- `apps/web/src/config/topics.ts`: assuntos como perguntas. O dataset entra no assunto pelo `theme`.
- `lib/summarize.ts` monta as frases de qualquer dataset. Ele inclui a comparação automática com o histórico
  ("É o menor valor em pelo menos N anos" / "Empata com…"), só quando é verdade nos dados carregados.
- `api.ts` ganhou cache em memória por URL: resumo, cartão e gráfico pedem o mesmo dado uma vez só.

### Cuidados de redação (regra daqui em diante)
- Frases factuais, sem adjetivo de juízo. Contexto só quando há referência oficial (meta do CMN) ou dado comparável.
- Valor negativo previsto: os templates usam {sign}/{abs} ("subiram/caíram") em vez de "subiram {value}".

### Verificado no navegador
- Home, assunto e dado no desktop (escuro) e no celular (claro, 375 px). Nenhuma página estoura a largura.
- typecheck e build ok.

### Problemas em aberto
- **Votações continuam em juridiquês** na página de Política ("Aprovada a Subemenda Substitutiva…"). É o próximo
  ponto que mais pesa na experiência. Opções: (a) agrupar votações por proposição e mostrar a ementa (o que a lei faz),
  buscando `/proposicoes/{id}` na Câmara; (b) resumo simples por LLM, com revisão e proveniência. Recomendação: começar
  por (a), que é dado oficial, e só usar (b) depois.
- Quando o descriptor muda, o navegador só vê a versão nova depois de recarregar a página (cache em memória). Isso é
  aceitável por enquanto.

### Próximos passos
1. Política legível: agrupar por proposição + ementa (opção a acima).
2. Camada 1 (necessidades básicas): saneamento, insegurança alimentar, homicídios.
3. Agendar a coleta.

---

## 2026-10-26 · Sessão 1: concepção e fundação

### Origem da ideia
Conversa sobre fontes públicas de dados do Brasil (IBGE, TSE, Câmara, Senado, DATASUS, INEP, SICONFI, BCB…)
evoluiu para: **uma página "Situação do Brasil" com a atualização máxima que cada fonte permite**, mais uma
linha do tempo política (presidentes, parlamentares, mandatos, vetos, derrubadas, tributos criados/extintos).

Motivação do autor, nas palavras dele: fazer algo em vez de só ver um país com potencial perdendo oportunidades.

### Público e tom (decidido)
- **Brasileiro médio**: dados sólidos, explicações coerentes, pouca ambiguidade, **sem clubismo**.
- **Um resumo para quem tem pouca instrução também serve muito.** Daí a regra: todo dataset tem
  `explanation.simple` (frases curtas, sem jargão) e `explanation.technical` (para auditar).
- A confiança vem da **auditabilidade**: cada número se desmonta em registro → consulta original → bruto arquivado.

### "Nota Brasil" (decidido: só camadas por enquanto)
- Proposta do autor: uma "nota" em camadas, inspirada na pirâmide de Maslow.
- Discussão: Maslow é contestado na psicologia. O **Índice de Progresso Social (IPS)** tem a mesma ideia
  (necessidades básicas → fundamentos do bem-estar → oportunidades) com metodologia reconhecida, e existe o IPS Brasil
  por município. **Adotamos a estrutura do IPS.**
- Riscos levantados: pesos são juízo de valor (vira alvo político); "momentânea" engana porque os dados têm idades
  diferentes; a normalização muda o resultado.
- Decisão: **mostrar só camadas, sem nota única no topo**, por enquanto. Quando houver nota: pesos ajustáveis pelo
  usuário, régua explícita (padrão: comparação com os últimos 10 anos do próprio Brasil), idade do dado visível.
- Na arquitetura, a nota será **um processador derivado** (lê DTOs, emite DTOs com proveniência). Não muda a fundação.
- Já preparado no catálogo: `DatasetDescriptor.layer` e `DatasetDescriptor.polarity` (maior-melhor / menor-melhor / neutro).

### Arquitetura (decidido)
Pedido do autor: Node + React + TypeScript; um back só de processamento; **cada origem tem seu processador que converte
para uma DTO genérica**; fontes muito bem documentadas, e essa documentação também aparece no front; telas reduzidas a
componentes mínimos e agnósticos; POO com interfaces guiando as leituras base; **maximizar o formato de entrada para
plugar coisas com baixa manutenção**.

Implementado (detalhes em `docs/ARQUITETURA.md`):
- Monorepo npm workspaces: `packages/core` (DTOs zod + catálogo), `packages/storage` (SQLite nativo do Node + arquivo
  de brutos), `apps/ingest` (framework + fontes), `apps/api` (HTTP só leitura), `apps/web` (Vite + React).
- **3 DTOs genéricas**: `Observation` (número × período × território), `Event` (algo aconteceu numa data),
  `Entity` (algo que existe no tempo). Todas com `provenance` obrigatória.
- **Documentação como dado**: `SourceManifest` e `DatasetDescriptor` são validados, gravados e exibidos no front.
- `BaseProcessor` (classe abstrata) cuida de proveniência e validação; a subclasse só implementa `collect()`.
- **Processadores parametrizáveis**: `SidraProcessor` é um só para qualquer tabela do IBGE; novo indicador = uma
  entrada em `series.ts`, sem código.
- **Auto-descoberta**: toda pasta em `apps/ingest/src/sources/<nome>/index.ts` vira fonte. Nada a registrar à mão.
- **Bruto arquivado**: toda resposta HTTP vai para `data/raw/<sha256>`; o registro guarda o hash; a API serve `/api/raw/:hash`.
- Front: `DatasetView` escolhe a view pelo `descriptor.view.type`. Cada view declara a consulta que precisa e
  renderiza qualquer dataset do seu tipo. Opções específicas vêm de `descriptor.view.options` (por exemplo, linhas de referência).

Escolhas técnicas e motivos:
- **SQLite nativo (`node:sqlite`)**: zero dependência nativa para compilar e um arquivo só. Trocar por Postgres depois
  é uma mudança só em `packages/storage`. Emite um ExperimentalWarning no Node 24, que é inofensivo.
- **tsx** para rodar TS no back (em vez do type stripping nativo) para permitir parameter properties e não depender
  de flags experimentais.
- **TypeScript 5.9** fixado: o npm já oferece o 7.x (o port nativo em Go), mas ainda não vale o risco.
- **zod 4** para validar DTOs e manifestos em tempo de execução: o processador nunca grava lixo.
- API em `node:http` puro com roteador mínimo (só GET): menos dependências, e a API é só leitura.
- Roteamento do front por hash: funciona em qualquer hospedagem estática.

### Fontes implementadas
| id | o quê | tipo | estado |
|---|---|---|---|
| `ibge-sidra` | IPCA 12 meses, IPCA mensal, desocupação (PNAD) | observation | ok, 360 registros |
| `ibge-localidades` | 27 UFs + 5.571 municípios (chave de cruzamento) | entity | ok |
| `camara-votacoes` | votações do Plenário da Câmara (janela padrão de 30 dias, `--opt dias=N`) | event | ok |

### Problemas encontrados
- **Banco Central (api.bcb.gov.br) rejeita as requisições daqui** (página "Requisição inválida" / HTTP 502), tanto
  com curl puro quanto com outros cabeçalhos. **Não tentamos contornar o bloqueio** (seria evasão de controle anti-robô).
  Pendente: entender o motivo (possível WAF/geobloqueio do IP, ou exigência de parâmetros novos) e usar o canal
  oficial certo (Olinda/OData, ou rodar de um IP brasileiro). Selic e câmbio ficam para depois.
- Endpoint de séries do IBGE: com vários níveis territoriais, usar `localidades=N1[all]|N3[all]`.
- Preview no navegador do app desktop subiu o dev server do projeto anterior (bonesandcoins) por cache da configuração.
  O servidor foi parado. A verificação visual fica para a próxima sessão.

### Verificado
- Ingestão completa: 3 fontes, cerca de 6 mil registros, 0 registros inválidos.
- API: `/api/sources`, `/api/datasets/:id/records`, `/api/feed`, `/api/raw/:hash` (200, conteúdo bruto) e 404 de dataset inexistente.
- `npm run typecheck` limpo nos 5 pacotes; `vite build` ok (243 kB de JS, 76 kB gzip).
- **Não verificado ainda: a renderização no navegador.**

### Próximos passos (ordem sugerida)
1. Verificar o front no navegador (claro/escuro, celular) e corrigir o que aparecer.
2. Agendar a coleta (cron/systemd ou GitHub Actions) para o "atualização máxima" virar realidade.
3. Fontes da camada **necessidades básicas**: saneamento e água (SNIS/SINISA ou PNAD), insegurança alimentar,
   homicídios (Atlas da Violência / SIM). Marcar `layer` nos descriptors.
4. Linha do tempo política: Senado (votações, vetos), deputados e senadores por legislatura, normas do DOU/Planalto.
5. BCB (Selic, câmbio, Focus) depois de resolver o bloqueio pelo canal oficial.
6. Explicação simples das votações (hoje é o texto técnico da Câmara): avaliar um LLM com revisão e guardar como
   campo derivado com proveniência.
7. Testes automatizados para os parsers (por exemplo, `parsePeriod` do SIDRA) e para o contrato das DTOs.
