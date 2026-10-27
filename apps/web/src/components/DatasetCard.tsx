import type { DatasetDescriptor, DatasetStats } from '@sb/core';
import { DatasetView } from '../views/registry.tsx';
import { href } from '../lib/router.ts';
import { Card, Explain, SourceLine } from './ui.tsx';

export function DatasetCard({ descriptor, stats }: { descriptor: DatasetDescriptor; stats?: DatasetStats }) {
  return (
    <Card>
      <h3>
        <a className="card-title-link" href={href.dataset(descriptor.id)}>
          {descriptor.title}
        </a>
      </h3>
      <DatasetView descriptor={descriptor} mode="card" />
      <Explain explanation={descriptor.explanation} />
      <SourceLine descriptor={descriptor} lastFetchedAt={stats?.lastFetchedAt} />
    </Card>
  );
}
