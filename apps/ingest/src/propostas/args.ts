export interface Args {
  refs?: string[];
  limite?: number;
  paralelo?: number;
  modelo?: string;
  refazer: boolean;
}

export function parseArgs(argv: string[]): Args {
  const out: Args = { refazer: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const v = argv[i + 1];
    if (a === '--refazer') out.refazer = true;
    else if (a === '--refs' && v) (out.refs = v.split(',')), i++;
    else if (a === '--limite' && v) (out.limite = Number(v)), i++;
    else if (a === '--paralelo' && v) (out.paralelo = Number(v)), i++;
    else if (a === '--modelo' && v) (out.modelo = v), i++;
  }
  return out;
}
