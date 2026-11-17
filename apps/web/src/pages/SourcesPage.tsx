import { href } from '../lib/router.ts';
import { useSource, useSources } from '../hooks/useDatasets.ts';
import { Async, BackLink, Card, Section, TextList } from '../components/ui.tsx';
import { DatasetLinks, ManifestFacts, RunStatus, RunsTable } from '../components/fontes/Fontes.tsx';

export function SourcesPage() {
  const state = useSources();
  return (
    <>
      <h1 className="page-title">Fontes</h1>
      <p className="lede">
        De onde vem cada dado deste site. Só usamos fontes oficiais e públicas, e guardamos uma cópia de cada resposta
        recebida para que qualquer pessoa possa conferir.
      </p>
      <Async state={state}>
        {(sources) => (
          <div className="grid">
            {sources.map(({ manifest: m, datasets, lastRun }) => (
              <Card key={m.id}>
                <h3>
                  <a className="card-title-link" href={href.source(m.id)}>
                    {m.name}
                  </a>
                </h3>
                <ManifestFacts m={m} />
                <div className="stat-sub">
                  Última coleta: <RunStatus run={lastRun} />
                </div>
                <DatasetLinks datasets={datasets} />
              </Card>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

export function SourcePage({ id }: { id: string }) {
  const state = useSource(id);
  return (
    <Async state={state}>
      {({ manifest: m, datasets, runs }) => (
        <>
          <BackLink href={href.sources()}>Fontes</BackLink>
          <h1 className="page-title">{m.name}</h1>
          <Section title="Sobre a fonte">
            <Card>
              <ManifestFacts m={m} />
              {m.access.notes && <p className="stat-sub">{m.access.notes}</p>}
              <p className="stat-sub">
                Cobertura: {m.coverage.territorial.join(', ')} · {m.coverage.temporal}
              </p>
            </Card>
          </Section>
          {m.limitations.length > 0 && (
            <Section title="Limitações conhecidas">
              <TextList items={m.limitations} />
            </Section>
          )}
          <Section title="Dados que vêm daqui">
            <DatasetLinks datasets={datasets} />
          </Section>
          <Section title="Histórico de coletas" intro="Cada vez que o sistema buscou dados nesta fonte, e o que aconteceu.">
            <RunsTable runs={runs} />
          </Section>
        </>
      )}
    </Async>
  );
}
