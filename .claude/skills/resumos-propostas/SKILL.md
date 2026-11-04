---
name: resumos-propostas
description: Gera os resumos em linguagem simples (IA) das propostas votadas que ainda não têm resumo e publica o arquivo. Use quando pedirem para atualizar, gerar ou rodar os resumos das propostas/votações novas.
---

# Atualizar os resumos das propostas

Os resumos são feitos aqui, com o Claude Code da máquina local (Haiku, pela assinatura), e vão para o ar pelo
arquivo versionado `apps/ingest/dados/resumos-propostas.json`. O servidor não tem os textos nem o Claude: ele só
importa esse arquivo a cada coleta. Detalhes em `docs/ARQUITETURA.md` e na Sessão 14 do `docs/DIARIO.md`.

## Passos

Rode da raiz do repositório, um passo de cada vez, e pare se algum falhar.

1. **Trazer as votações novas para o banco local.**
   `npm run ingest -- camara-votacoes senado`
   As propostas candidatas saem dos registros do banco local, então sem isso nada novo aparece.
   A coleta também importa o arquivo de resumos atual.

2. **Baixar os textos oficiais que faltam.**
   `npm run textos`
   Baixa o PDF de cada proposta e Casa sem texto (500 ms entre pedidos, não acelere) e guarda só os artigos.
   PDF só de imagem fica marcado com `problema` e não ganha resumo: é esperado, não é erro.

3. **Gerar os resumos que faltam.**
   `npm run resumos -- --paralelo 3`
   Só resume textos sem resumo na versão atual do prompt (`VERSAO_PROMPT` em `apps/ingest/src/propostas/resumos.ts`).
   Para testar antes, use `--limite 5`. Para refazer propostas específicas, `--refs PL-1123-2025 --refazer`.
   No fim ele exporta o arquivo JSON e mostra o caminho. Se parar por 3 falhas seguidas, veja a mensagem
   (limite da assinatura, `claude` não encontrado) e avise o usuário em vez de insistir.

4. **Conferir.**
   - `git diff --stat apps/ingest/dados/resumos-propostas.json`: deve haver só acréscimos (ou trocas, se usou `--refazer`).
   - Leia 3 ou 4 resumos novos: título curto, descrição de 2 a 3 frases, neutra, sem falar do andamento da proposta.
     Se algum estiver ruim, conte ao usuário antes de publicar.
   - `npm run typecheck`.

5. **Publicar** (só com o ok do usuário, porque cada push na `main` vai direto para o ar):
   ```
   git add apps/ingest/dados/resumos-propostas.json
   git commit -m "Resumos das propostas novas (N)"
   git push git@github.com:ricardoponcio/situacao-brasil.git main
   ```
   O `origin` é HTTPS sem credencial, por isso o push usa a URL SSH.
   Os resumos aparecem no site quando o servidor reconstrói e a coleta roda de novo.

## O que contar ao usuário no fim

Quantos textos novos, quantos PDFs sem texto, quantos resumos novos, erros, custo equivalente em dólar
(o script mostra) e o commit publicado.
