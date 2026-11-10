/**
 * Leitura dos arquivos .dbc do DATASUS: um DBF (dBase) com o corpo comprimido pelo PKWare DCL "implode".
 * Formato: cabeçalho do DBF sem compressão (o tamanho está nos bytes 8–9), 4 bytes de CRC e o resto comprimido.
 */
import { explode } from 'node-pkware/simple';

export interface Dbf {
  registros: number;
  campos: string[];
  /** Valor do campo no registro `i`, sem espaços nas pontas ('' quando vazio ou campo inexistente). */
  valor(i: number, campo: string): string;
}

export function lerDbc(arquivo: Buffer): Dbf {
  const cab = arquivo.readUInt16LE(8);
  const comprimido = arquivo.subarray(cab + 4);
  const corpo = Buffer.from(
    explode(comprimido.buffer.slice(comprimido.byteOffset, comprimido.byteOffset + comprimido.length)),
  );
  return lerDbf(Buffer.concat([arquivo.subarray(0, cab), corpo]));
}

export function lerDbf(dbf: Buffer): Dbf {
  const registros = dbf.readUInt32LE(4);
  const cab = dbf.readUInt16LE(8);
  const tamanho = dbf.readUInt16LE(10);
  const campos = new Map<string, { inicio: number; tamanho: number }>();
  let pos = 1; // o primeiro byte de cada registro marca se ele foi apagado
  for (let p = 32; p < cab && dbf[p] !== 0x0d; p += 32) {
    const nome = dbf.toString('latin1', p, p + 11).replace(/\0.*$/s, '').trim().toUpperCase();
    const len = dbf[p + 16]!;
    campos.set(nome, { inicio: pos, tamanho: len });
    pos += len;
  }
  if (cab + registros * tamanho > dbf.length) throw new Error('DBF truncado: o arquivo tem menos registros que o cabeçalho diz');
  return {
    registros,
    campos: [...campos.keys()],
    valor(i, campo) {
      const c = campos.get(campo);
      if (!c) return '';
      const ini = cab + i * tamanho + c.inicio;
      return dbf.toString('latin1', ini, ini + c.tamanho).trim();
    },
  };
}

/** Registro marcado como apagado no DBF ('*'). */
export function apagado(dbf: Buffer, i: number): boolean {
  return dbf[dbf.readUInt16LE(8) + i * dbf.readUInt16LE(10)] === 0x2a;
}
