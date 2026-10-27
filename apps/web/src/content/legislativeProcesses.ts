/**
 * Como cada tipo de proposição tramita. Conteúdo editorial baseado na Constituição Federal
 * (com o artigo citado em cada etapa) e nos regimentos. É dado: o componente ProcessFlow
 * desenha qualquer processo descrito neste formato.
 *
 * Simplificações assumidas (ditas no texto quando relevantes): o caminho mostrado começa na
 * Câmara, que é o caso mais comum; regimes de urgência e ritos especiais não aparecem.
 */

export type Actor = 'proponente' | 'camara' | 'senado' | 'congresso' | 'presidencia' | 'resultado';

export const ACTORS: Record<Actor, { label: string; text: string }> = {
  proponente: { label: 'Quem propõe', text: 'Quem apresenta a proposta' },
  camara: { label: 'Câmara', text: 'Câmara dos Deputados (513 deputados)' },
  senado: { label: 'Senado', text: 'Senado Federal (81 senadores)' },
  congresso: { label: 'Congresso', text: 'Câmara e Senado juntos' },
  presidencia: { label: 'Presidência', text: 'Presidente da República' },
  resultado: { label: 'Resultado', text: 'Como termina' },
};

export interface Path {
  when: string;
  to: string;
}

export interface Step {
  id: string;
  actor: Actor;
  title: string;
  text: string;
  /** Detalhe técnico/base legal, mostrado sob demanda. */
  detail?: string;
  /** Caminhos possíveis. Sem `paths`, segue para a próxima etapa. Etapas de resultado terminam. */
  paths?: Path[];
}

export interface LegislativeProcess {
  id: string;
  /** Sigla usada pela Câmara/Senado (liga com os dados de votação no futuro). */
  sigla: string;
  name: string;
  summary: string;
  quorum: string;
  legalBasis: { label: string; url: string };
  steps: Step[];
}

const CF = 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm';

const propositura: Step = {
  id: 'proposta',
  actor: 'proponente',
  title: 'Alguém apresenta o projeto',
  text:
    'Podem propor: deputados, senadores, comissões, o Presidente da República, o STF, os tribunais superiores, o Procurador-Geral da República e os próprios cidadãos (iniciativa popular, com assinaturas de pelo menos 1% dos eleitores, de pelo menos 5 estados).',
  detail:
    'CF, art. 61. Projetos do Presidente, dos tribunais e de iniciativa popular começam pela Câmara (art. 64). Se quem propôs for senador, a ordem se inverte: começa no Senado e depois vai para a Câmara.',
};

const veto: Step = {
  id: 'veto',
  actor: 'congresso',
  title: 'Congresso analisa o veto',
  text:
    'Deputados e senadores, em sessão conjunta, decidem se mantêm ou derrubam o veto. Para derrubar, é preciso maioria absoluta nas duas Casas: 257 deputados e 41 senadores.',
  detail: 'CF, art. 66, §4º. Prazo de 30 dias; depois disso, o veto passa à frente das outras votações. A votação é aberta.',
  paths: [
    { when: 'Se derrubar o veto', to: 'lei' },
    { when: 'Se mantiver um veto parcial', to: 'lei' },
    { when: 'Se mantiver um veto total', to: 'arquivado' },
  ],
};

function leiOrdinariaOuComplementar(kind: 'PL' | 'PLP'): LegislativeProcess {
  const plp = kind === 'PLP';
  return {
    id: kind.toLowerCase(),
    sigla: kind,
    name: plp ? 'Projeto de Lei Complementar' : 'Projeto de Lei',
    summary: plp
      ? 'Para assuntos que a Constituição manda tratar por lei complementar, como regras gerais de impostos. Exige mais votos que uma lei comum.'
      : 'O caminho mais comum para criar ou mudar uma lei.',
    quorum: plp
      ? 'Maioria absoluta: pelo menos 257 deputados e 41 senadores votando "sim".'
      : 'Maioria simples: mais votos "sim" do que "não", com pelo menos metade da Casa presente.',
    legalBasis: { label: plp ? 'Constituição, arts. 61 a 69' : 'Constituição, arts. 61 a 67', url: CF },
    steps: [
      propositura,
      {
        id: 'comissoes',
        actor: 'camara',
        title: 'Comissões da Câmara estudam o texto',
        text:
          'Grupos menores de deputados, por assunto, analisam o projeto, podem mudá-lo e dão um parecer. A Comissão de Constituição e Justiça (CCJ) verifica se ele respeita a Constituição.',
        detail: plp
          ? 'Projeto de lei complementar sempre precisa ir ao Plenário.'
          : 'Muitos projetos têm "poder conclusivo": aprovados nas comissões, não precisam ir ao Plenário, a não ser que 1/10 dos deputados recorra (CF, art. 58, §2º, I).',
      },
      {
        id: 'plenario-camara',
        actor: 'camara',
        title: 'Plenário da Câmara vota',
        text: 'Todos os deputados podem votar.',
        paths: [
          { when: 'Se aprovar', to: 'senado' },
          { when: 'Se rejeitar', to: 'arquivado' },
        ],
      },
      {
        id: 'senado',
        actor: 'senado',
        title: 'Senado revisa',
        text: 'O projeto passa pelas comissões e pelo Plenário do Senado.',
        detail: 'CF, art. 65.',
        paths: [
          { when: 'Se aprovar sem mudanças', to: 'presidente' },
          { when: 'Se mudar o texto', to: 'volta-camara' },
          { when: 'Se rejeitar', to: 'arquivado' },
        ],
      },
      {
        id: 'volta-camara',
        actor: 'camara',
        title: 'Câmara decide sobre as mudanças',
        text: 'A Câmara só pode aceitar ou recusar o que o Senado mudou. Não pode escrever texto novo.',
        detail: 'CF, art. 65, parágrafo único.',
        paths: [{ when: 'Depois de decidir', to: 'presidente' }],
      },
      {
        id: 'presidente',
        actor: 'presidencia',
        title: 'Presidente sanciona ou veta',
        text:
          'O Presidente tem 15 dias úteis. Pode sancionar (concordar), vetar tudo ou vetar só algumas partes. Se não fizer nada no prazo, a sanção é automática.',
        detail: 'CF, art. 66, §§1º e 3º. O veto só pode alegar que o texto é inconstitucional ou contrário ao interesse público.',
        paths: [
          { when: 'Se sancionar', to: 'lei' },
          { when: 'Se vetar (tudo ou parte)', to: 'veto' },
        ],
      },
      veto,
      {
        id: 'lei',
        actor: 'resultado',
        title: plp ? 'Vira lei complementar' : 'Vira lei',
        text:
          'A lei é promulgada e publicada no Diário Oficial. As partes com veto mantido ficam de fora; as com veto derrubado entram. A lei passa a valer na data indicada nela.',
      },
      {
        id: 'arquivado',
        actor: 'resultado',
        title: 'Arquivado',
        text: 'O projeto não segue. A mesma proposta só pode voltar na mesma sessão legislativa (ano) com apoio da maioria absoluta de uma das Casas.',
        detail: 'CF, art. 67.',
      },
    ],
  };
}

export const PROCESSES: LegislativeProcess[] = [
  leiOrdinariaOuComplementar('PL'),
  leiOrdinariaOuComplementar('PLP'),
  {
    id: 'pec',
    sigla: 'PEC',
    name: 'Proposta de Emenda à Constituição',
    summary: 'Muda a própria Constituição. É o caminho mais difícil, e o Presidente não pode vetar.',
    quorum: '3/5 dos votos, em dois turnos, em cada Casa: 308 deputados e 49 senadores.',
    legalBasis: { label: 'Constituição, art. 60', url: CF },
    steps: [
      {
        id: 'proposta',
        actor: 'proponente',
        title: 'Alguém apresenta a PEC',
        text:
          'Podem propor: pelo menos 1/3 dos deputados (171) ou dos senadores (27), o Presidente da República, ou mais da metade das Assembleias Legislativas dos estados.',
        detail:
          'CF, art. 60. Nenhuma PEC pode acabar com as "cláusulas pétreas": a federação, o voto direto, secreto, universal e periódico, a separação dos Poderes e os direitos e garantias individuais (§4º).',
      },
      {
        id: 'ccj',
        actor: 'camara',
        title: 'CCJ da Câmara diz se a PEC pode seguir',
        text: 'A Comissão de Constituição e Justiça verifica só se a proposta é permitida, não se é boa.',
      },
      {
        id: 'especial',
        actor: 'camara',
        title: 'Comissão especial analisa o conteúdo',
        text: 'Uma comissão criada só para aquela PEC discute o mérito e pode mudar o texto.',
      },
      {
        id: 'plenario-camara',
        actor: 'camara',
        title: 'Plenário da Câmara vota duas vezes',
        text: 'São dois turnos de votação. Em cada um, precisa de pelo menos 308 votos "sim".',
        paths: [
          { when: 'Se aprovar nos dois turnos', to: 'senado' },
          { when: 'Se rejeitar', to: 'arquivada' },
        ],
      },
      {
        id: 'senado',
        actor: 'senado',
        title: 'Senado: CCJ e dois turnos no Plenário',
        text: 'Em cada turno, precisa de pelo menos 49 votos "sim".',
        detail:
          'Se o Senado mudar o texto, a parte alterada volta para a Câmara. O texto vai e volta até as duas Casas aprovarem a mesma versão; partes já aprovadas pelas duas podem ser promulgadas antes.',
        paths: [
          { when: 'Se aprovar o mesmo texto', to: 'promulgacao' },
          { when: 'Se mudar o texto', to: 'plenario-camara' },
          { when: 'Se rejeitar', to: 'arquivada' },
        ],
      },
      {
        id: 'promulgacao',
        actor: 'congresso',
        title: 'Câmara e Senado promulgam',
        text: 'A PEC não passa pelo Presidente da República: não existe sanção nem veto. As Mesas da Câmara e do Senado promulgam a emenda.',
        detail: 'CF, art. 60, §3º.',
      },
      {
        id: 'emenda',
        actor: 'resultado',
        title: 'Vira Emenda Constitucional',
        text: 'O texto da Constituição muda a partir da publicação.',
      },
      {
        id: 'arquivada',
        actor: 'resultado',
        title: 'Arquivada',
        text: 'Uma PEC rejeitada não pode ser apresentada de novo no mesmo ano legislativo.',
        detail: 'CF, art. 60, §5º.',
      },
    ],
  },
  {
    id: 'mpv',
    sigla: 'MPV',
    name: 'Medida Provisória',
    summary: 'O Presidente cria uma regra que já vale na hora, mas o Congresso precisa confirmar em até 120 dias.',
    quorum: 'Maioria simples em cada Casa.',
    legalBasis: { label: 'Constituição, art. 62', url: CF },
    steps: [
      {
        id: 'edicao',
        actor: 'presidencia',
        title: 'Presidente edita a medida provisória',
        text: 'Só pode ser usada em caso de relevância e urgência. Começa a valer no mesmo dia, com força de lei.',
        detail:
          'CF, art. 62. Prazo de 60 dias, prorrogável por mais 60 (o prazo para durante o recesso). Depois de 45 dias sem votação, ela passa à frente das outras votações da Casa onde estiver. Alguns assuntos não podem ser tratados por MP, como direito penal e eleitoral (§1º).',
      },
      {
        id: 'comissao-mista',
        actor: 'congresso',
        title: 'Comissão mista analisa',
        text: 'Um grupo de deputados e senadores, juntos, dá um parecer e pode mudar o texto.',
      },
      {
        id: 'plenario-camara',
        actor: 'camara',
        title: 'Plenário da Câmara vota',
        text: 'A votação começa sempre pela Câmara.',
        paths: [
          { when: 'Se aprovar', to: 'plenario-senado' },
          { when: 'Se rejeitar', to: 'perde-validade' },
        ],
      },
      {
        id: 'plenario-senado',
        actor: 'senado',
        title: 'Plenário do Senado vota',
        text: 'Se o Senado mudar o texto, ele volta para a Câmara decidir sobre as mudanças.',
        paths: [
          { when: 'Se aprovar sem mudanças', to: 'lei' },
          { when: 'Se o Congresso mudou o texto', to: 'sancao' },
          { when: 'Se rejeitar', to: 'perde-validade' },
        ],
      },
      {
        id: 'sancao',
        actor: 'presidencia',
        title: 'Presidente sanciona ou veta as mudanças',
        text:
          'Quando o Congresso muda o texto, ele vira um "projeto de lei de conversão" e volta ao Presidente, que pode sancionar ou vetar. O veto segue o mesmo caminho de qualquer veto.',
        paths: [{ when: 'Depois da sanção (e do veto, se houver)', to: 'lei' }],
      },
      {
        id: 'lei',
        actor: 'resultado',
        title: 'Vira lei',
        text: 'A medida provisória é convertida em lei e deixa de ser provisória.',
      },
      {
        id: 'perde-validade',
        actor: 'resultado',
        title: 'Perde a validade',
        text:
          'Se for rejeitada ou o prazo de 120 dias acabar, a MP deixa de valer. O que aconteceu enquanto ela valia continua regido por ela, a não ser que o Congresso decida diferente em até 60 dias.',
        detail: 'CF, art. 62, §§3º e 11. Não pode ser reeditada no mesmo ano legislativo (§10).',
      },
    ],
  },
  {
    id: 'vet',
    sigla: 'VET',
    name: 'Veto',
    summary: 'Quando o Presidente discorda de uma lei aprovada pelo Congresso, no todo ou em parte. A palavra final é do Congresso.',
    quorum: 'Para derrubar: maioria absoluta nas duas Casas, 257 deputados e 41 senadores.',
    legalBasis: { label: 'Constituição, art. 66', url: CF },
    steps: [
      {
        id: 'veta',
        actor: 'presidencia',
        title: 'Presidente veta',
        text:
          'Pode vetar a lei inteira ou só partes (artigos, parágrafos, incisos ou alíneas inteiros, nunca palavras soltas). Precisa explicar o motivo.',
        detail: 'CF, art. 66, §§1º e 2º. Prazo de 15 dias úteis; o Presidente do Senado é avisado em até 48 horas.',
      },
      {
        id: 'sessao',
        actor: 'congresso',
        title: 'Sessão conjunta do Congresso',
        text: 'Deputados e senadores votam juntos, em votação aberta, se mantêm ou derrubam o veto.',
        detail: 'CF, art. 66, §§4º e 6º. Prazo de 30 dias; depois disso, o veto passa à frente das outras votações.',
        paths: [
          { when: 'Se 257 deputados e 41 senadores votarem para derrubar', to: 'derrubado' },
          { when: 'Se não alcançar esses votos', to: 'mantido' },
        ],
      },
      {
        id: 'derrubado',
        actor: 'resultado',
        title: 'Veto derrubado',
        text: 'A parte vetada volta a fazer parte da lei e é promulgada.',
        detail: 'CF, art. 66, §§5º e 7º. Se o Presidente não promulgar em 48 horas, o Presidente do Senado promulga.',
      },
      {
        id: 'mantido',
        actor: 'resultado',
        title: 'Veto mantido',
        text: 'A parte vetada fica fora da lei.',
      },
    ],
  },
];
