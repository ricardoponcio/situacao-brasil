import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

  save(body: string, url: string, contentType: string): RawBlobInfo {
    const hash = createHash('sha256').update(body).digest('hex');
    const file = path.join(this.dir, hash);
    if (!existsSync(file)) writeFileSync(file, body);
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

  read(hash: string): { info: RawBlobInfo; body: Buffer } | null {
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    const info = this.index.get(hash);
    const file = path.join(this.dir, hash);
    if (!info || !existsSync(file)) return null;
    return { info, body: readFileSync(file) };
  }
}
