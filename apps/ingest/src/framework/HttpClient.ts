import type { RawStore } from '@sb/storage';

/** Metadados de origem de uma resposta: viram a `provenance` dos registros. */
export interface Origin {
  url: string;
  rawHash: string;
  fetchedAt: string;
}

export interface FetchResult<T> {
  data: T;
  origin: Origin;
}

export interface HttpOptions {
  timeoutMs?: number;
  retries?: number;
}

/**
 * Cliente HTTP único para todas as fontes:
 *  - identifica o projeto de forma honesta no User-Agent;
 *  - espaça requisições ao mesmo host (não sobrecarregar serviço público);
 *  - tenta de novo em falhas transitórias;
 *  - arquiva TODA resposta bruta no RawStore (auditoria).
 */
export class HttpClient {
  private readonly lastHit = new Map<string, number>();

  constructor(
    private readonly raw: RawStore,
    private readonly minIntervalMs = 300,
    private readonly userAgent = 'situacao-brasil/0.1 (projeto aberto de dados publicos)',
  ) {}

  async getJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<FetchResult<T>> {
    const { body, contentType } = await this.getText(url, opts);
    let data: T;
    try {
      data = JSON.parse(body) as T;
    } catch {
      throw new Error(`Resposta não é JSON (${contentType}) em ${url}: ${body.slice(0, 120)}`);
    }
    const info = this.raw.save(body, url, contentType);
    return { data, origin: { url, rawHash: info.hash, fetchedAt: info.fetchedAt } };
  }

  private async getText(url: string, { timeoutMs = 30_000, retries = 2 }: HttpOptions) {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      await this.throttle(url);
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = await res.text();
        if (res.ok) return { body, contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
        lastErr = new Error(`HTTP ${res.status} em ${url}`);
        if (res.status < 500 && res.status !== 429) break; // erro do cliente: não adianta repetir
      } catch (err) {
        lastErr = err;
      }
      await sleep(1000 * 2 ** attempt);
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private async throttle(url: string) {
    const host = new URL(url).host;
    const wait = (this.lastHit.get(host) ?? 0) + this.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastHit.set(host, Date.now());
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
