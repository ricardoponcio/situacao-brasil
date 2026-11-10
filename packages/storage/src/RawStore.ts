import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RawBlobInfo } from '@sb/core';
import { rawDir } from './paths.ts';
import type { RawBlobRepository } from './repositories.ts';

/**
 * Arquiva cada resposta bruta da origem, endereçada pelo sha256 do conteúdo.
 * Qualquer registro pode ser conferido contra o bruto que o gerou.
 */
export class RawStore {
  constructor(private readonly index: RawBlobRepository, private readonly dir = rawDir) {
    mkdirSync(dir, { recursive: true });
  }

  /** Caminho do bruto no disco (para ferramentas externas, como o pdftotext). */
  pathOf(hash: string): string {
    return path.join(this.dir, hash);
  }

  /**
   * `keep: false` registra só a identidade do bruto (hash, endereço, tamanho), sem guardar o conteúdo. Serve a
   * arquivos grandes que a origem mantém para sempre: quem quiser conferir baixa de novo e compara o hash.
   */
  save(body: string | Buffer, url: string, contentType: string, { keep = true } = {}): RawBlobInfo {
    const hash = createHash('sha256').update(body).digest('hex');
    const file = path.join(this.dir, hash);
    if (keep && !existsSync(file)) writeFileSync(file, body);
    const info: RawBlobInfo = {
      hash,
      url,
      fetchedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(body),
      contentType,
    };
    this.index.register(info);
    return info;
  }

  /** Apaga o conteúdo guardado, mantendo o registro (hash, endereço, data). */
  discard(hash: string): void {
    if (/^[a-f0-9]{64}$/.test(hash)) rmSync(path.join(this.dir, hash), { force: true });
  }

  /** Registro do bruto e se o conteúdo está guardado. */
  info(hash: string): (RawBlobInfo & { kept: boolean }) | null {
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    const info = this.index.get(hash);
    return info ? { ...info, kept: existsSync(path.join(this.dir, hash)) } : null;
  }

  read(hash: string): { info: RawBlobInfo; body: Buffer } | null {
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    const info = this.index.get(hash);
    const file = path.join(this.dir, hash);
    if (!info || !existsSync(file)) return null;
    return { info, body: readFileSync(file) };
  }
}
