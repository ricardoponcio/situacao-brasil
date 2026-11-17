import { THEME_LABEL } from '../lib/format.ts';
import { useDataset } from '../hooks/useDatasets.ts';
import { Async, BackLink, Card, Explain, LazyDetails, Section, TextList } from '../components/ui.tsx';
import { DatasetView } from '../views/registry.tsx';
import { DatasetSummary } from '../components/summary.tsx';
import { ReadWith } from '../components/ReadWith.tsx';
import { FichaTecnica } from '../components/dados/FichaTecnica.tsx';
import { AuditTable } from '../components/dados/AuditTable.tsx';
import { backFromDataset } from '../controllers/assuntos.ts';

export function DatasetPage({ id }: { id: string }) {
  const state = useDataset(id);
  return (
    <Async state={state}>
      {({ descriptor: d, source, stats }) => {
        const back = backFromDataset(d);
        return (
          <>
            <BackLink href={back.href}>{back.label}</BackLink>
            <p className="hero-kicker">{THEME_LABEL[d.theme] ?? d.theme}</p>
            <h1 className="page-title">{d.title}</h1>
            <DatasetSummary d={d} />
            <ReadWith d={d} />

            <Section title="Os números">
              <Card>
                <DatasetView descriptor={d} mode="full" />
              </Card>
            </Section>

            <Section title="O que é">
              <Card>
                <Explain explanation={d.explanation} open />
              </Card>
            </Section>

            {d.caveats.length > 0 && (
              <Section title="Cuidados ao ler este dado">
                <TextList items={d.caveats} />
              </Section>
            )}

            <LazyDetails title="Ficha técnica" intro="Tudo o que é preciso para conferir este dado por conta própria.">
              {() => <FichaTecnica d={d} source={source} stats={stats} />}
            </LazyDetails>

            <LazyDetails
              title="Registros e auditoria"
              intro="Os 50 registros mais recentes. Cada um aponta para a consulta original e para a resposta bruta arquivada no momento da coleta."
            >
              {() => <AuditTable datasetId={d.id} unit={d.unit} decimals={d.decimals} />}
            </LazyDetails>
          </>
        );
      }}
    </Async>
  );
}
