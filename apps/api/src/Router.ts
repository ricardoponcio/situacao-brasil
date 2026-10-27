import type { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface Request {
  params: Record<string, string>;
  query: URLSearchParams;
  raw: IncomingMessage;
}

/** Resposta: objeto → JSON; RawResponse → corpo como está. */
export interface RawResponse {
  raw: Buffer | string;
  contentType: string;
}

type Handler = (req: Request) => unknown | Promise<unknown>;

/** Roteador mínimo só de GET: a API é de leitura. */
export class Router {
  private readonly routes: { pattern: RegExp; keys: string[]; handler: Handler }[] = [];

  get(path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' + path.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), '([^/]+)')) + '/?$',
    );
    this.routes.push({ pattern, keys, handler });
    return this;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      if (req.method !== 'GET') throw new HttpError(405, 'Somente GET');
      for (const r of this.routes) {
        const m = r.pattern.exec(url.pathname);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
        const out = await r.handler({ params, query: url.searchParams, raw: req });
        if (isRaw(out)) {
          res.writeHead(200, { 'Content-Type': out.contentType });
          res.end(out.raw);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(out));
        }
        return;
      }
      throw new HttpError(404, `Rota não encontrada: ${url.pathname}`);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  }
}

function isRaw(v: unknown): v is RawResponse {
  return typeof v === 'object' && v !== null && 'raw' in v && 'contentType' in v;
}
