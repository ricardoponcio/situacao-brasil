import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { href, useRoute } from './lib/router.ts';
import { HomePage } from './pages/HomePage.tsx';
import { DatasetPage } from './pages/DatasetPage.tsx';
import { TopicPage } from './pages/TopicPage.tsx';
import { SourcePage, SourcesPage } from './pages/SourcesPage.tsx';
import { PropostaPage } from './pages/PropostaPage.tsx';

function App() {
  const [section, id] = useRoute();
  let page;
  if (section === 'dados' && id) page = <DatasetPage id={id} />;
  else if (section === 'assunto' && id) page = <TopicPage id={id} />;
  else if (section === 'proposta' && id) page = <PropostaPage refKey={id} />;
  else if (section === 'fontes' && id) page = <SourcePage id={id} />;
  else if (section === 'fontes') page = <SourcesPage />;
  else page = <HomePage />;

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href={href.home()}>
          <img className="brand-logo" src="/favicon.svg" alt="" />
          <span>
            Situação do Brasil
            <small>Dados oficiais, explicados e auditáveis</small>
          </span>
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
      <footer className="footer">
        Um projeto <a href="https://pensebrasil.com.br">Pense Brasil</a>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
