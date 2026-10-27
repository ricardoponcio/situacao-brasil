const nf = new Map<number, Intl.NumberFormat>();

export function formatNumber(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  let f = nf.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    nf.set(decimals, f);
  }
  return f.format(v);
}

export function formatValue(v: number | null | undefined, unit: string | undefined, decimals = 1): string {
  const n = formatNumber(v, decimals);
  if (n === '–' || !unit) return n;
  return unit === '%' ? `${n}%` : `${n} ${unit}`;
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Datas sem hora ("2026-10-15") são tratadas como data local, não UTC. */
function parse(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

export const formatDate = (iso: string) => dateFmt.format(parse(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(parse(iso));

export function timeAgo(iso: string): string {
  const s = (Date.now() - parse(iso).getTime()) / 1000;
  if (s < 90) return 'agora há pouco';
  const m = s / 60;
  if (m < 60) return `há ${Math.round(m)} min`;
  const h = m / 60;
  if (h < 36) return `há ${Math.round(h)} h`;
  const d = h / 24;
  if (d < 45) return `há ${Math.round(d)} dias`;
  return `em ${formatDate(iso)}`;
}

export const FREQUENCY_LABEL: Record<string, string> = {
  'tempo-real': 'em tempo real',
  diaria: 'todo dia',
  semanal: 'toda semana',
  mensal: 'todo mês',
  trimestral: 'a cada 3 meses',
  anual: 'todo ano',
  irregular: 'sem data fixa',
};

export const THEME_LABEL: Record<string, string> = {
  economia: 'Economia',
  trabalho: 'Trabalho e renda',
  saude: 'Saúde',
  educacao: 'Educação',
  seguranca: 'Segurança',
  'contas-publicas': 'Contas públicas',
  politica: 'Política',
  territorio: 'Territórios',
  'meio-ambiente': 'Meio ambiente',
};
