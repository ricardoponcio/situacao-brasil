/**
 * Leitura dos arquivos .dbc do DATASUS: um DBF (dBase) com o corpo comprimido pelo PKWare DCL "implode".
 * Formato: cabeçalho do DBF sem compressão (o tamanho está nos bytes 8–9), 4 bytes de CRC e o resto comprimido.
 *
 * A leitura é em fluxo, a partir do arquivo no disco: um registro por vez, sem nunca ter o arquivo inteiro na
 * memória. Importa porque o DBF descomprimido da dengue passa de alguns GB, e o servidor tem 1 GB de RAM.
 */
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { explode, stream } from 'node-pkware';

/** Um registro do DBF. Válido só durante a chamada de `porRegistro`. */
export interface Registro {
  /** Valor do campo, sem espaços nas pontas ('' quando vazio ou campo inexistente). */
  valor(campo: string): string;
}

export interface Cabecalho {
  registros: number;
  campos: string[];
}

interface Campos {
  registros: number;
  /** Tamanho do cabeçalho do DBF. */
  cab: number;
  /** Tamanho de cada registro. */
  tamanho: number;
  mapa: Map<string, { inicio: number; tamanho: number }>;
}

function lerCabecalho(buf: Buffer): Campos {
  const registros = buf.readUInt32LE(4);
  const cab = buf.readUInt16LE(8);
  const tamanho = buf.readUInt16LE(10);
  const mapa = new Map<string, { inicio: number; tamanho: number }>();
  let pos = 1; // o primeiro byte de cada registro marca se ele foi apagado
  for (let p = 32; p < cab && buf[p] !== 0x0d; p += 32) {
    const nome = buf.toString('latin1', p, p + 11).replace(/\0.*$/s, '').trim().toUpperCase();
    const len = buf[p + 16]!;
    mapa.set(nome, { inicio: pos, tamanho: len });
    pos += len;
  }
  return { registros, cab, tamanho, mapa };
}

/**
 * Lê um .dbc do disco, chamando `porRegistro` para cada registro não apagado.
 * Pausa de vez em quando (`respiroMs`) para não tomar a CPU do servidor inteira.
 */
export async function lerDbc(
  arquivo: string,
  porRegistro: (r: Registro) => void,
  { respiroMs = 0 } = {},
): Promise<Cabecalho> {
  const fd = await open(arquivo, 'r');
  let campos: Campos;
  try {
    const inicio = Buffer.alloc(12);
    await fd.read(inicio, 0, 12, 0);
    const cab = Buffer.alloc(inicio.readUInt16LE(8));
    await fd.read(cab, 0, cab.length, 0);
    campos = lerCabecalho(cab);
  } finally {
    await fd.close();
  }
  const { registros, tamanho, mapa } = campos;

  let atual: Buffer = Buffer.alloc(0);
  const registro: Registro = {
    valor(campo) {
      const c = mapa.get(campo);
      return c ? atual.toString('latin1', c.inicio, c.inicio + c.tamanho).trim() : '';
    },
  };

  let sobra: Buffer = Buffer.alloc(0);
  let lidos = 0;
  let desdeRespiro = 0;
  const consumidor = new Writable({
    // Pedaços pequenos: o descompressor espera o consumidor, e a memória não cresce.
    highWaterMark: 1 << 16,
    write(chunk: Buffer, _enc, done) {
      const buf = sobra.length ? Buffer.concat([sobra, chunk]) : chunk;
      let p = 0;
      for (; p + tamanho <= buf.length && lidos < registros; p += tamanho, lidos++) {
        if (buf[p] === 0x2a) continue; // '*' = registro apagado
        atual = buf.subarray(p, p + tamanho);
        porRegistro(registro);
      }
      // Copia a sobra: um subarray seguraria o pedaço inteiro na memória.
      sobra = lidos < registros ? Buffer.from(buf.subarray(p)) : Buffer.alloc(0);
      desdeRespiro += chunk.length;
      if (respiroMs > 0 && desdeRespiro > 1 << 20) {
        desdeRespiro = 0;
        setTimeout(done, respiroMs);
      } else done();
    },
  });

  await pipeline(
    createReadStream(arquivo, { start: campos.cab + 4, highWaterMark: 1 << 16 }),
    stream.through(explode()),
    consumidor,
  );
  if (lidos < registros) throw new Error(`DBF truncado: ${lidos} de ${registros} registros`);
  return { registros, campos: [...mapa.keys()] };
}
