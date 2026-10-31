# Fontes candidatas

Levantamento de 30/10/2026. Cada endereço foi **testado de verdade** (de uma conexão no Brasil), não só tirado da
documentação. Antes de implementar, siga `COMO-ADICIONAR-FONTE.md`.

Legenda do acesso:
- **API ok**: respondeu JSON sem cadastro.
- **Chave**: API oficial, mas pede uma chave gratuita (cadastro com e-mail ou gov.br). Chave entra por variável de
  ambiente, nunca no código.
- **Arquivo**: só download (CSV, XLSX, ZIP). Dá para coletar, mas o formato muda mais e exige mais cuidado.
- **Falhou**: não respondeu ou a API antiga saiu do ar.

**Produção:** o servidor fica fora do Brasil e sai por um proxy liberado só para `gov.br` e `leg.br` (sessão 6).
Fontes em outros domínios (`jus.br`, `inpe.br`, `org.br`) precisam ser testadas lá e, se recusarem, ter o domínio
incluído no proxy.

---

## Prioridade 1: pouco esforço, muito ganho

| Fonte | O que traz | Acesso | Endereço testado | Assunto / camada |
|---|---|---|---|---|
| **IBGE SIDRA (mais tabelas)** | ver lista abaixo | API ok | `servicodados.ibge.gov.br/api/v3/agregados/{tabela}` | vários |
| **Banco Central, SGS** | Selic (432), dólar (1), IGP-M, desemprego dessazonalizado, dívida bruta, crédito | API ok | `api.bcb.gov.br/dados/serie/bcdata.sgs.{n}/dados` | economia |
| **Banco Central, Olinda** | Focus (o que o mercado espera de inflação, PIB e juros), PTAX | API ok | `olinda.bcb.gov.br/olinda/servico/Expectativas/...` | economia |
| **Senado Federal** | votações do Plenário, situação atual de cada matéria, vetos e resultado dos vetos | API ok | `legis.senado.leg.br/dadosabertos/plenario/lista/votacao/{ini}/{fim}`, `.../materia/situacaoatual/tramitacao/{data}`, `.../materia/vetos/{ano}`, `.../plenario/resultado/veto/{codigo}` | política |
| **IBGE, calendário de divulgação** | quando sai o próximo dado de cada pesquisa | API ok | `servicodados.ibge.gov.br/api/v3/calendario/` | todas (mostrar "próxima atualização") |

**O Banco Central voltou a responder.** Na sessão 1 a API recusava as requisições. Hoje respondeu normalmente daqui;
falta testar pelo proxy do servidor (o domínio é `bcb.gov.br`, então já está liberado).

**Senado** fecha o que a sessão 7 deixou aberto: quando a proposta sai da Câmara, a situação para de mudar até
voltar. Com a situação do Senado, o "agora / próximo passo" acompanha a proposta até o fim. Os vetos também entram aqui
(o diagrama de veto já existe).

### Tabelas do SIDRA que valem a pena (só configuração em `series.ts`, sem código)

| Tabela | O quê | Período | Camada (IPS) | Leia junto |
|---|---|---|---|---|
| 9552 | Segurança alimentar dos domicílios (fome) | 2023–2024 | necessidades básicas | renda per capita |
| 6731 | Fonte de abastecimento de água | 2016–2025 | necessidades básicas | esgoto |
| 7192 | Banheiro e tipo de esgoto | 2019–2025 | necessidades básicas | água |
| 6732 | A água da rede chega todo dia? (a 7190, listada antes, era o recorte errado) | 2016–2025 | necessidades básicas | 6731 (ter rede ≠ ter água) |
| 7113 / 7125 | Analfabetismo (por idade, sexo, cor) | até 2025 | fundamentos | escolarização |
| 7138 / 7139 | Taxa de escolarização | 2016–2025 | fundamentos | analfabetismo |
| 7307 | Domicílios com internet | 2016–2025 | fundamentos | – |
| 10197 | Trabalho infantil | 2016–2025 | oportunidades | – |
| 7435 | Desigualdade de renda (Gini) | 2012–2025 | oportunidades | renda média, 7521 |
| 7521 / 7527 | Distribuição da renda por faixas | 2012–2025 | oportunidades | Gini |
| 5932 | PIB trimestral (variação) | até 2º tri 2026 | economia | PIB per capita (6784) |
| 6784 | PIB e PIB per capita | até 2023 | economia | PIB trimestral |
| 6579 | População estimada | 2026 | base para taxas | – |
| 8880 / 8881 | Vendas no varejo | até ago/2026 | economia | – |
| 5906 | Volume de serviços | até ago/2026 | economia | – |
| 8888 | Produção industrial | até ago/2026 | economia | – |

Pares "leia junto" previstos na sessão 3 que estas tabelas destravam: PIB ↔ PIB per capita; inflação ↔ renda real.

---

## Prioridade 2: fonte nova, API boa

| Fonte | O que traz | Acesso | Endereço testado | Assunto |
|---|---|---|---|---|
| **Ipeadata** | milhares de séries já organizadas (inclui séries de outros órgãos, com histórico longo) | API ok (OData) | `ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='...')` | economia, social |
| **Tesouro, SICONFI** | contas de estados e municípios (receita, despesa, dívida, gasto com pessoal) | API ok | `apidatalake.tesouro.gov.br/ords/siconfi/tt/...` | contas públicas |
| **Tesouro Transparente** | dívida pública federal, resultado do governo | API ok (CKAN, arquivos) | `tesourotransparente.gov.br/ckan/api/3/action/...` | contas públicas |
| **Comex Stat (MDIC)** | exportações e importações | API ok | `api-comexstat.mdic.gov.br` | economia |
| **Câmara (mais endpoints)** | deputados, gastos da cota parlamentar, presença | API ok | `dadosabertos.camara.leg.br/api/v2/deputados/{id}/despesas` | política |
| **TSE** | candidatos, eleitorado, resultados de eleições | API ok (CKAN, arquivos grandes) | `dadosabertos.tse.jus.br/api/3/action/...` | política (linha do tempo de mandatos) |
| **Compras.gov** | compras e contratos do governo federal | API ok | `dadosabertos.compras.gov.br` | contas públicas |
| **ANEEL** | tarifas de energia, cortes de luz (DEC/FEC) | API ok (CKAN) | `dadosabertos.aneel.gov.br/api/3/action/...` | necessidades básicas |
| **ONS** | geração e consumo de energia | API ok (CKAN) | `dados.ons.org.br/api/3/action/...` | economia, ambiente |

**Ipeadata** pode substituir várias fontes de uma vez: um processador parametrizável (como o do SIDRA) e cada série
vira uma linha de configuração. Cuidado: confirmar sempre a fonte original da série e citá-la.

---

## Prioridade 3: precisa de chave gratuita

| Fonte | O que traz | Endereço | Observação |
|---|---|---|---|
| **Portal da Transparência (CGU)** | gastos do governo, Bolsa Família por município, empresas punidas | `api.portaldatransparencia.gov.br` (deu 401 sem chave) | chave por e-mail, gratuita |
| **dados.gov.br** | catálogo de todos os órgãos federais | `dados.gov.br/dados/api/...` (401 sem chave) | chave pela conta gov.br. Serve mais para **achar** fontes |
| **DataJud (CNJ)** | processos na Justiça (quantidade, tempo) | `api-publica.datajud.cnj.jus.br` (401 sem chave) | a chave pública é publicada pelo CNJ na documentação |

Decisão do autor necessária: criar as contas e guardar as chaves (variável de ambiente no servidor).

---

## Prioridade 4: só arquivo para baixar

| Fonte | O que traz | Onde | Observação |
|---|---|---|---|
| **DATASUS / SIM e SINASC** | mortes por causa (inclui homicídios), mortalidade infantil, nascimentos | `datasus.saude.gov.br/transferencia-de-arquivos` (arquivos .dbc) | formato antigo, precisa conversor. O portal OpenDataSUS trocou de site e a API CKAN antiga não responde |
| **SINESP (Ministério da Justiça)** | crimes registrados por UF | página em `gov.br/mj/.../dados-nacionais-1` (planilhas) | atualização mensal |
| **INEP** | IDEB, Censo Escolar, ENEM | `gov.br/inep/.../dados-abertos` | planilhas e microdados grandes |
| **SINISA (antigo SNIS)** | saneamento por município (água, esgoto, perdas) | `gov.br/cidades/.../sinisa` | complementa a PNAD por município |
| **ANP** | preço dos combustíveis por cidade | `gov.br/anp/.../serie-historica-de-precos-de-combustiveis` | CSV semanal |
| **Anatel** | acessos de banda larga e celular por município | `anatel.gov.br/dadosabertos/...` (ZIP) | ZIP grande |
| **INPE, queimadas** | focos de queimada diários | `dataserver-coids.inpe.br/queimadas/...` (CSV) | domínio fora do proxy |
| **Receita Federal** | arrecadação de impostos | `gov.br/receitafederal/.../arrecadacao` | planilhas |

---

## Não funcionou agora (rever depois)

| Fonte | Problema |
|---|---|
| **Atlas da Violência (Ipea)** | a API `/atlasviolencia/api/v1` dá 404: o site foi refeito. Usar o SIM (DATASUS) direto, que é a fonte original |
| **CAGED / RAIS (PDET)** | `pdet.mte.gov.br` não abriu conexão. Tentar de novo e verificar o FTP oficial de microdados |
| **INPE TerraBrasilis (desmatamento)** | a API do painel deu 502. Tentar o serviço de dados (WFS/GeoServer) ou os arquivos do PRODES |
| **IBGE, projeções de população** | o endpoint `/api/v1/projecoes/populacao` deu 404. Usar a tabela 6579 do SIDRA |
| **MapBiomas, SEEG** | não são órgãos públicos (rede de ONGs e universidades) e bloquearam o acesso automático (503/403). Só pelo canal oficial deles, se fizer sentido |

---

## Ordem sugerida

1. ~~**SIDRA**: as tabelas de necessidades básicas~~. Feito na sessão 9 (9552, 6731, 6732, 7192).
2. ~~**Senado**: situação e votações~~. Feito na sessão 10 (API nova `/processo` e `/votacao`; a antiga `/materia` e `/plenario/lista` está descontinuada).
3. **Banco Central**: Selic, dólar e Focus. Pendente desde a sessão 1.
4. **Calendário do IBGE**: mostrar "próxima atualização em ..." em cada dado.
5. **Ipeadata** como processador parametrizável.
6. **SICONFI**: contas de estados e municípios (primeiro passo para olhar além do país inteiro).
7. Depois: DATASUS (homicídios e mortalidade infantil), chaves de API e o resto.
