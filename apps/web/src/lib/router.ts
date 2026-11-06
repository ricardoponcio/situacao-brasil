import { useEffect, useState } from 'react';

/** Roteamento por hash: sem dependência e funciona em qualquer hospedagem estática. */
export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parts;
}

export const href = {
  home: () => '#/',
  topic: (id: string, tab?: string) => `#/assunto/${encodeURIComponent(id)}${tab ? `/${encodeURIComponent(tab)}` : ''}`,
  dataset: (id: string) => `#/dados/${encodeURIComponent(id)}`,
  proposta: (ref: string) => `#/proposta/${encodeURIComponent(ref)}`,
  sources: () => '#/fontes',
  source: (id: string) => `#/fontes/${encodeURIComponent(id)}`,
};
