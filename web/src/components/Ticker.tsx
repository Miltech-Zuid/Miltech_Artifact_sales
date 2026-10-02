import { useData } from '../lib/dataStore';
import { somWaarde, type Kpi } from '../lib/kpi';
import { eurK } from '../lib/utils';

export function Ticker({ K }: { K: Kpi }) {
  const d = useData();
  const tk = [
    { k: '#3987e5', l: 'Open pipeline', v: eurK(K.waarde), d: K.open.length + ' dossiers' },
    { k: '#9085e9', l: 'Gewogen', v: eurK(K.gewogen), d: '' },
    { k: '#fab219', l: 'Offertes uit', v: String(K.off.length), d: eurK(somWaarde(K.off)) },
    {
      k: K.laat.length ? '#e05252' : '#5fd35f',
      l: 'Te laat opgevolgd',
      v: String(K.laat.length),
      d: K.laat.length ? 'actie nodig' : 'alles bij',
    },
    { k: '#5fd35f', l: 'Gewonnen ' + new Date().getFullYear(), v: eurK(K.wonW), d: K.hit != null ? K.hit + '% hitrate' : '' },
    {
      k: '#2bb6a3',
      l: 'Prospects',
      v: String(d.prospects.length),
      d: d.opdrachten.filter((o) => o.status !== 'klaar').length + ' zoekopdrachten open',
    },
  ];
  const items = [...tk, ...tk];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-in">
        {items.map((t, i) => (
          <div className="tk" key={i}>
            <i style={{ background: t.k }} />
            <span>{t.l}</span>
            <b>{t.v}</b>
            <em style={{ color: t.k, fontStyle: 'normal', fontWeight: 600 }}>{t.d}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
