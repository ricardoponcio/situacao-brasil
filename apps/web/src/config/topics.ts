/**
 * Assuntos da página inicial, escritos como as perguntas que uma pessoa comum faz.
 * Um dataset entra no assunto pelo seu `theme`: fonte nova com tema existente aparece sozinha.
 * Assunto sem dados aparece como "em breve".
 */
import type { Theme } from '@sb/core';

/** Blocos explicativos que não vêm de dataset (ver pages/TopicPage.tsx → MODULES). */
export type TopicModule = 'processo-legislativo';

export interface Topic {
  id: string;
  title: string;
  question: string;
  intro: string;
  themes: Theme[];
  modules?: TopicModule[];
}

export const TOPICS: Topic[] = [
  {
    id: 'custo-de-vida',
    title: 'Custo de vida',
    question: 'Os preços estão subindo muito?',
    intro: 'Quanto as coisas estão ficando mais caras, e se isso está dentro do que o país definiu como aceitável.',
    themes: ['economia'],
  },
  {
    id: 'trabalho',
    title: 'Trabalho',
    question: 'Está fácil arrumar emprego?',
    intro: 'Quantas pessoas procuram trabalho e não encontram, e como isso mudou com o tempo.',
    themes: ['trabalho'],
  },
  {
    id: 'politica',
    title: 'Política',
    question: 'O que o Congresso decidiu?',
    intro:
      'O que foi votado em Brasília, em que passo cada proposta está agora e o que ainda falta para virar lei, com o link para o registro oficial.',
    themes: ['politica'],
    modules: ['processo-legislativo'],
  },
  {
    id: 'saude',
    title: 'Saúde',
    question: 'Como está a saúde da população?',
    intro: '',
    themes: ['saude'],
  },
  {
    id: 'educacao',
    title: 'Educação',
    question: 'As crianças estão aprendendo?',
    intro: '',
    themes: ['educacao'],
  },
  {
    id: 'seguranca',
    title: 'Segurança',
    question: 'O país está mais seguro?',
    intro: '',
    themes: ['seguranca'],
  },
  {
    id: 'contas-publicas',
    title: 'Contas públicas',
    question: 'Para onde vai o dinheiro dos impostos?',
    intro: '',
    themes: ['contas-publicas'],
  },
];

export const topicOfTheme = (theme: Theme) => TOPICS.find((t) => t.themes.includes(theme));
