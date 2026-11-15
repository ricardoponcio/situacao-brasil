/**
 * Acesso ao FTP público do DATASUS (sem senha). Um pedido por vez, com pausa entre arquivos: é serviço público.
 */
import { Client } from 'basic-ftp';

export const HOST = 'ftp.datasus.gov.br';
export const BASE = '/dissemin/publicos';

export interface ArquivoRemoto {
  /** Relativo a BASE: SIM/CID10/DORES/DOAC2024.dbc */
  caminho: string;
  bytes: number;
  /** Data da listagem + tamanho. Muda quando a origem substitui o arquivo. */
  versao: string;
}

export class DatasusFtp {
  private client = new Client(120_000);
  private ultimo = 0;

  constructor(private readonly pausaMs = 1000) {}

  async conectar(): Promise<void> {
    await this.client.access({ host: HOST, user: 'anonymous', password: 'anonymous@', secure: false });
  }

  /** Arquivos .dbc de uma pasta (relativa a BASE). */
  async listar(pasta: string): Promise<ArquivoRemoto[]> {
    await this.esperar();
    const itens = await this.client.list(`${BASE}/${pasta}`);
    const out: ArquivoRemoto[] = [];
    for (const f of itens) {
      if (!f.isFile || !/\.dbc$/i.test(f.name)) continue;
      out.push({ caminho: `${pasta}/${f.name}`, bytes: f.size, versao: `${f.rawModifiedAt} ${f.size}` });
    }
    return out;
  }

  /** Data exata de alteração (MDTM). A listagem às vezes só traz o dia. */
  async modificado(caminho: string): Promise<string> {
    await this.esperar();
    return (await this.client.lastMod(`${BASE}/${caminho}`)).toISOString();
  }

  /** Baixa direto para um arquivo no disco (os maiores passam de 100 MB: não cabem na memória do servidor). */
  async baixar(caminho: string, destino: string): Promise<void> {
    await this.esperar();
    await this.client.downloadTo(destino, `${BASE}/${caminho}`);
  }

  url(caminho: string): string {
    return `ftp://${HOST}${BASE}/${caminho}`;
  }

  fechar(): void {
    this.client.close();
  }

  private async esperar() {
    const falta = this.ultimo + this.pausaMs - Date.now();
    if (falta > 0) await new Promise((r) => setTimeout(r, falta));
    this.ultimo = Date.now();
  }
}
