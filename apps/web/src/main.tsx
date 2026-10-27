import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { href, useRoute } from './lib/router.ts';
import { HomePage } from './pages/HomePage.tsx';
import { DatasetPage } from './pages/DatasetPage.tsx';
import { TopicPage } from './pages/TopicPage.tsx';
import { SourcePage, SourcesPage } from './pages/SourcesPage.tsx';

function App() {
  const [section, id] = useRoute();
  let page;
  if (section === 'dados' && id) page = <DatasetPage id={id} />;
  else if (section === 'assunto' && id) page = <TopicPage id={id} />;
  else if (section === 'fontes' && id) page = <SourcePage id={id} />;
  else if (section === 'fontes') page = <SourcesPage />;
  else page = <HomePage />;

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href={href.home()}>
          Situação do Brasil
          <small>Dados oficiais, explicados e auditáveis</small>
        </a>
        <nav className="nav">
          <a href={href.home()} aria-current={!section ? 'page' : undefined}>
            Início
          </a>
          <a href={href.sources()} aria-current={section === 'fontes' ? 'page' : undefined}>
            Fontes
          </a>
        </nav>
      </header>
      <main>{page}</main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
