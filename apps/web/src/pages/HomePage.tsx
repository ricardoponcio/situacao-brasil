import { formatDate } from '../lib/format.ts';
import { href } from '../lib/router.ts';
import { homeTopics } from '../controllers/assuntos.ts';
import { useDatasets } from '../hooks/useDatasets.ts';
import { BriefLine, TopicTile } from '../components/assuntos/Inicio.tsx';

export function HomePage() {
  const datasets = useDatasets();
  const { active, upcoming } = homeTopics(datasets.status === 'ok' ? datasets.data.map((i) => i.descriptor) : []);

  return (
    <>
      <section className="hero">
        <p className="hero-kicker">{formatDate(new Date().toISOString().slice(0, 10))}</p>
        <h1 className="hero-title">
          O Brasil hoje, em <em>poucas frases</em>
        </h1>
        {datasets.status === 'error' && <p className="status-error">Não foi possível carregar os dados.</p>}
        <ul className="brief">
          {active.map(({ topic, lead }) => (
            <BriefLine key={topic.id} topic={topic} lead={lead} />
          ))}
        </ul>
        <p className="hero-note">
          Tudo aqui vem de órgãos oficiais, como o IBGE e a Câmara dos Deputados. Cada número pode ser conferido até a
          origem.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Escolha um assunto</h2>
          <p>Comece pelo que mais importa para você. Dentro de cada assunto, dá para ir aprofundando.</p>
        </div>
        <div className="tiles">
          {active.map(({ topic, lead }) => (
            <TopicTile key={topic.id} topic={topic} lead={lead} />
          ))}
        </div>
        {upcoming.length > 0 && (
          <p className="upcoming">
            <span className="muted">Em breve:</span> {upcoming.map((t) => t.title).join(' · ')}
          </p>
        )}
      </section>

      <details className="about">
        <summary>Como este site organiza o retrato do país</summary>
        <p>
          Vamos agrupar os indicadores em três camadas, do mais básico ao mais avançado, seguindo a ideia do Índice de
          Progresso Social: <strong>necessidades básicas</strong> (comida, água, moradia, segurança),{' '}
          <strong>base para uma vida boa</strong> (saúde, escola, informação, meio ambiente) e{' '}
          <strong>oportunidades</strong> (direitos, inclusão, chance de crescer). Por enquanto, as camadas ainda estão
          sendo montadas.
        </p>
        <p>
          Não damos uma "nota única" para o Brasil: qualquer nota depende de escolher o que pesa mais, e isso é opinião.
          Preferimos mostrar os dados e explicar como ler cada um. <a href={href.sources()}>Veja as fontes</a>.
        </p>
      </details>
    </>
  );
}
