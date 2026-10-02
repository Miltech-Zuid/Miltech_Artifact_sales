import { useEffect, useMemo } from 'react';
import { LeadDrawer } from './components/LeadDrawer';
import { PlakDrawer } from './components/PlakDrawer';
import { Ticker } from './components/Ticker';
import { ToastHost } from './components/ToastHost';
import { TopBar } from './components/TopBar';
import { VIEWS } from './lib/constants';
import { useData } from './lib/dataStore';
import { kpi } from './lib/kpi';
import { useMe } from './lib/session';
import { sluitLade, useUi } from './lib/ui';
import { begroeting } from './lib/utils';
import { SyntessView } from './syntess/SyntessView';
import { Klanten } from './views/Klanten';
import { Overzicht } from './views/Overzicht';
import { Pipeline } from './views/Pipeline';
import { Prospects } from './views/Prospects';

export function App() {
  const d = useData();
  const me = useMe();
  const { view, lade } = useUi();
  const K = useMemo(() => kpi(d.leads), [d.leads]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') sluitLade();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const live = d.conn === 'live';

  return (
    <>
      <div className="app">
        <div className="glow1" />
        <div className="glow2" />
        <TopBar K={K} />
        <main>
          <div className="wrap">
            <header className="top">
              <div>
                <div className="kicker">{VIEWS[view].k}</div>
                <h1>{view === 'overzicht' ? begroeting(me) : VIEWS[view].n}</h1>
              </div>
              <div className="pill">
                <span className={'live' + (live ? '' : ' off')} />
                <span>{live ? 'Gedeelde database · live' : d.conn === 'offline' ? 'Geen verbinding met de server' : 'Verbinden…'}</span>
              </div>
            </header>
            <Ticker K={K} />
            <div>
              {view === 'overzicht' && <Overzicht K={K} />}
              {view === 'pipeline' && <Pipeline />}
              {view === 'prospects' && <Prospects />}
              {view === 'syntess' && <SyntessView />}
              {view === 'klanten' && <Klanten />}
            </div>
            <div className="foot">
              Hoe Claude helpt: dagstart, opvolgmails en het afmaken van Syntess-offertes op de pagina. Elke offerte in de offerte-tool loopt
              automatisch mee in de pipeline; kennis en bibliotheek komen uit het project Offerte Tool (importeren via “Offerte uit
              Syntess”). Alle gegevens staan in de gedeelde database op de server.
            </div>
          </div>
        </main>
      </div>
      {lade?.soort === 'lead' && <LeadDrawer key={lade.key} start={lade.lead} />}
      {lade?.soort === 'plak' && <PlakDrawer key={lade.key} />}
      <ToastHost />
    </>
  );
}
