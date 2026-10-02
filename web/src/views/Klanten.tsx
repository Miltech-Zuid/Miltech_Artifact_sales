import { useEffect, useState } from 'react';
import { OPEN, SECTOREN } from '../lib/constants';
import { bewaar, bewaarConfig, useData, verwijder } from '../lib/dataStore';
import { toast } from '../lib/toast';
import { nid, norm, zonderId } from '../lib/utils';
import { ZekerKnop } from '../components/ZekerKnop';

export function Klanten() {
  const d = useData();
  const [imp, setImp] = useState('');
  const [kq, setKq] = useState('');
  const [team, setTeam] = useState(d.team.join(', '));

  useEffect(() => setTeam(d.team.join(', ')), [d.team]);

  const q = kq.toLowerCase();
  const K = d.klanten
    .filter((k) => !q || String(k.naam).toLowerCase().includes(q))
    .sort((a, b) => String(a.naam).localeCompare(String(b.naam)));

  async function importeer() {
    const lines = imp
      .split(/\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    const seen = new Set(d.klanten.map((k) => norm(k.naam)));
    const nieuw: { naam: string; plaats: string; sector: string }[] = [];
    for (const ln of lines) {
      const [naam, plaats] = ln.split(/[;\t]/).map((x) => (x || '').trim());
      if (!naam || seen.has(norm(naam))) continue;
      seen.add(norm(naam));
      nieuw.push({ naam, plaats: plaats || '', sector: '' });
    }
    let n = 0;
    for (const k of nieuw) if (await bewaar('klanten', nid('k'), k)) n++;
    setImp('');
    toast(n + ' klant' + (n === 1 ? '' : 'en') + ' toegevoegd');
  }

  async function bewaarTeam() {
    const t = team
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!t.length) return;
    if (await bewaarConfig('team', { namen: t })) toast('Team bewaard');
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid2">
        <section className="card stack">
          <div>
            <h2>Klanten importeren</h2>
            <div className="sub">
              Plak één klant per regel, <b className="soft">naam; plaats</b>. Het klantbestand wordt gebruikt om te zien of een prospect al
              klant is.
            </div>
          </div>
          <textarea
            className="input"
            rows={5}
            value={imp}
            onChange={(e) => setImp(e.target.value)}
            placeholder={'Bedrijfsnaam; Plaats\nBedrijfsnaam; Plaats'}
          />
          <div className="row">
            <button className="btn pri" onClick={importeer}>Voeg toe</button>
            <span className="sub" style={{ margin: 0 }}>Dubbele namen worden overgeslagen.</span>
          </div>
        </section>
        <section className="card stack">
          <div>
            <h2>Team</h2>
            <div className="sub">Namen die je kunt kiezen als eigenaar van een dossier. Gescheiden door komma's.</div>
          </div>
          <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team" />
          <div>
            <button className="btn" onClick={bewaarTeam}>Bewaar team</button>
          </div>
        </section>
      </div>
      <section className="card stack">
        <div className="row between">
          <div>
            <h2>{d.klanten.length} klanten</h2>
            <div className="sub">Geef ontbrekende sectoren op, dan telt de prospect-zoeker ze mee.</div>
          </div>
          <input
            className="input"
            type="search"
            style={{ width: 220 }}
            placeholder="Zoek klant"
            value={kq}
            onChange={(e) => setKq(e.target.value)}
            aria-label="Zoek klant"
          />
        </div>
        {K.length ? (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Klant</th>
                  <th>Sector</th>
                  <th>Pipeline</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {K.map((k) => {
                  const n = d.leads.filter((l) => norm(l.bedrijf) === norm(k.naam) && OPEN.includes(l.fase)).length;
                  return (
                    <tr key={k.id}>
                      <td>
                        <div className="b">{k.naam}</div>
                        <div className="x">{k.plaats || ''}</div>
                      </td>
                      <td>
                        <select
                          className="input"
                          aria-label="Sector"
                          style={{ minWidth: 160 }}
                          value={k.sector || ''}
                          onChange={(e) => bewaar('klanten', k.id, { ...zonderId(k), sector: e.target.value })}
                        >
                          <option value="">Onbekend</option>
                          {SECTOREN.map((s) => (
                            <option key={s.id} value={s.id}>{s.n}</option>
                          ))}
                        </select>
                      </td>
                      <td>{n ? <span className="chip ok">{n} open</span> : <span className="muted">—</span>}</td>
                      <td>
                        <ZekerKnop label="Verwijder" onBevestig={() => void verwijder('klanten', k.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Nog geen klanten. Plak hierboven je klantenlijst.</div>
        )}
      </section>
    </div>
  );
}
