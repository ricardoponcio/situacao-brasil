/**
 * Baixa o texto oficial (PDF) das propostas que aparecem nos registros e guarda só os artigos.
 *
 *   npm run textos                          # todas as que ainda não têm texto
 *   npm run textos -- --limite 20
 *   npm run textos -- --refs PL-1123-2025,MPV-1313-2025
 *   npm run textos -- --refazer             # baixa de novo mesmo as que já têm
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Storage, type Casa } from '@sb/storage';
import { HttpClient } from '../framework/HttpClient.ts';
import { parseArgs } from './args.ts';

const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/';
const SENADO = 'https://legis.senado.leg.br/dadosabertos/processo/';

const args = parseArgs(process.argv.slice(2));
const storage = new Storage();
const http = new HttpClient(storage.raw, 500);

let alvo = storage.textos.candidatas();
if (args.refs) alvo = alvo.filter((c) => args.refs!.includes(c.ref));
if (!args.refazer) alvo = alvo.filter((c) => !storage.textos.has(c.ref, c.casa));
if (args.limite) alvo = alvo.slice(0, args.limite);

console.log(`${alvo.length} textos para baixar`);
let ok = 0;
for (const [i, c] of alvo.entries()) {
  const base = { ref: c.ref, casa: c.casa, fetchedAt: new Date().toISOString() };
  try {
    const url = await urlDoTexto(c.casa, c.id);
    if (!url) {
      storage.textos.upsert({ ...base, url: null, rawHash: null, textoHash: null, texto: '', problema: 'sem texto publicado' });
      console.log(`  [${i + 1}/${alvo.length}] ${c.ref} (${c.casa}): sem texto publicado`);
      continue;
    }
    const pdf = await http.getBytes(url, { timeoutMs: 60_000 });
    if (pdf.data.subarray(0, 5).toString() !== '%PDF-') throw new Error(`não é PDF (${pdf.contentType})`);
    const texto = soOsArtigos(execFileSync('pdftotext', ['-enc', 'UTF-8', storage.raw.pathOf(pdf.origin.rawHash), '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }));
    const problema = texto.length < 200 ? 'PDF sem texto legível (provavelmente imagem)' : null;
    storage.textos.upsert({
      ...base,
      url,
      rawHash: pdf.origin.rawHash,
      textoHash: problema ? null : createHash('sha256').update(texto).digest('hex'),
      texto,
      problema,
    });
    ok += problema ? 0 : 1;
    console.log(`  [${i + 1}/${alvo.length}] ${c.ref} (${c.casa}): ${problema ?? `${texto.length} caracteres`}`);
  } catch (err) {
    // Falha de rede não grava nada: a próxima rodada tenta de novo.
    console.log(`  [${i + 1}/${alvo.length}] ${c.ref} (${c.casa}): erro, ${(err as Error).message}`);
  }
}
console.log(`${ok} textos guardados`);
storage.close();

async function urlDoTexto(casa: Casa, id: string): Promise<string | null> {
  if (casa === 'camara') {
    const { data } = await http.getJson<{ dados: { urlInteiroTeor?: string | null } }>(CAMARA + id);
    return data.dados.urlInteiroTeor || null;
  }
  const { data } = await http.getJson<{ documento?: { url?: string | null } }>(SENADO + id);
  return data.documento?.url || null;
}

/**
 * Tira a justificação (argumento do autor; nas propostas do governo, a exposição de motivos dos
 * ministros, "EM nº", "EMI nº", "EXM nº"), carimbos de assinatura e cabeçalhos repetidos.
 */
function soOsArtigos(bruto: string): string {
  const semJustificacao = bruto.split(
    /^\s*(?:JUSTIFICA(?:ÇÃO|TIVA)\s*$|(?:EXM|EMI|EM)\s+n[º°o.]|(?:Excelentíssimo\s+)?Senhor Presidente da República,?\s*$)/m,
  )[0]!;
  return semJustificacao
    .replace(/\f/g, '\n')
    .split('\n')
    .filter(
      (l) =>
        !/^\s*Apresentação: .* - /.test(l) &&
        !/Assinado eletronicamente/.test(l) &&
        !/Para verificar a assinatura/.test(l) &&
        !/^\s*\*[A-Z0-9]{8,}\*\s*$/.test(l) &&
        !/^\s*(PL|PLP|PEC|PDL|MPV|PRS) n\.\d+\/\d{4}\s*$/.test(l),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
