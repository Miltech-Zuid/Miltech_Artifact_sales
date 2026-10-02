import { useEffect, useRef, useState } from 'react';
import { BRONNEN, CONTEXT, FASE, FASEN, OPEN, SECTOREN, faseVan } from '../lib/constants';
import { aiFout, sample, sampleJson } from '../lib/claude';
import { bewaar, useData, verwijder } from '../lib/dataStore';
import { isKlant } from '../lib/kpi';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { FaseId, Lead } from '../lib/types';
import { gaNaar, sluitLade, type LeadConcept } from '../lib/ui';
import { datumNL, nid, plusDagen, vandaag } from '../lib/utils';
import { Spark, Spin } from './Spark';
import { openSyntessOfferte } from '../syntess/syStore';

type Stap = { busy: boolean; data?: { actie: string; datum: string; waarom: string }; err?: string };

export function LeadDrawer({ start }: { start: LeadConcept }) {
  const d = useData();
  const [D, setD] = useState<LeadConcept>(() => ({ ...start, log: start.log || [] }));
  const [note, setNote] = useState('');
  const [mail, setMail] = useState<{ busy: boolean; text: string } | null>(null);
  const [stap, setStap] = useState<Stap | null>(null);
  const [zeker, setZeker] = useState(false);
  const [bezig, setBezig] = useState(false);
  const bedrijfRef = useRef<HTMLInputElement>(null);
  const isNew = !D.id;
  const f = faseVan(D.fase);
  const kl = isKlant(D.bedrijf || '', d.klanten);

  useEffect(() => {
    if (!start.id) bedrijfRef.current?.focus();
  }, [start.id]);

  const upd = <K extends keyof LeadConcept>(k: K, v: LeadConcept[K]) => setD((x) => ({ ...x, [k]: v }));

  function opslaanVorm(x: LeadConcept): Omit<Lead, 'id'> {
    const c: Record<string, unknown> = { ...x };
    delete c.id;
    delete c._pid;
    return c as unknown as Omit<Lead, 'id'>;
  }

  async function opslaan() {
    if (!D.bedrijf?.trim()) {
      toast('Vul een bedrijfsnaam in');
      bedrijfRef.current?.focus();
      return;
    }
    setBezig(true);
    const nu = vandaag();
    const x: LeadConcept = {
      ...D,
      bedrijf: D.bedrijf.trim(),
      waarde: +(D.waarde ?? 0) || 0,
      kans: D.kans == null || (D.kans as unknown) === '' ? FASE[D.fase].p : Math.max(0, Math.min(100, +D.kans)),
      log: [...(D.log || [])],
    };
    const id = x.id || nid('l');
    if (!x.id) {
      x.aangemaakt = nu;
      x.log.push({ d: nu, t: 'Dossier aangemaakt' + (x.bron ? ' (bron: ' + x.bron + ')' : ''), w: getMe() });
    }
    x.gewijzigd = new Date().toISOString();
    if ((x.fase === 'gewonnen' || x.fase === 'verloren') && !x.gesloten) x.gesloten = nu;
    if (OPEN.includes(x.fase)) delete x.gesloten;
    const pid = x._pid;
    const ok = await bewaar('leads', id, opslaanVorm(x));
    setBezig(false);
    if (!ok) return;
    toast('Opgeslagen');
    if (pid) {
      const p = d.prospects.find((y) => y.id === pid);
      if (p) {
        const { id: pId, ...rest } = p;
        await bewaar('prospects', pId, { ...rest, status: 'lead' });
      }
    }
    sluitLade();
  }

  async function voegNotitieToe() {
    const t = note.trim();
    if (!t) return;
    const nieuw: LeadConcept = { ...D, log: [...(D.log || []), { d: vandaag(), t, w: getMe() }] };
    setD(nieuw);
    setNote('');
    if (nieuw.id) {
      nieuw.gewijzigd = new Date().toISOString();
      if (await bewaar('leads', nieuw.id, opslaanVorm(nieuw))) toast('Notitie bewaard');
    }
  }

  async function aiMail() {
    setMail({ busy: true, text: '' });
    const input = `${CONTEXT}\n\nDossier (JSON):\n${JSON.stringify({ bedrijf: D.bedrijf, contact: D.contact, fase: f.n, wat: D.omschrijving, waarde: D.waarde, offertenummer: D.offertenr, volgendeActie: D.volgendeActie, logboek: (D.log || []).slice(-8) })}\n\nSchrijf een korte, persoonlijke opvolgmail aan ${D.contact || 'de contactpersoon'} namens ${D.eigenaar || getMe() || 'Miltech'} van Miltech Zuid Nederland. Begin met een regel "Onderwerp: ...", dan een lege regel en de mail. Verwijs concreet naar wat in het logboek staat en stel één duidelijke vervolgstap voor (bijv. een belmoment). Maximaal 120 woorden. Geen verzonnen feiten.`;
    try {
      const r = await sample(input, { onText: (u) => setMail({ busy: true, text: u.text }) });
      setMail({ busy: false, text: r.text });
    } catch (e) {
      setMail({ busy: false, text: aiFout(e) });
    }
  }

  async function aiStap() {
    setStap({ busy: true });
    const input = `${CONTEXT}\n\nVandaag: ${vandaag()}.\nDossier (JSON):\n${JSON.stringify({ bedrijf: D.bedrijf, fase: f.n, wat: D.omschrijving, waarde: D.waarde, volgendeActie: D.volgendeActie, volgendeDatum: D.volgendeDatum, logboek: (D.log || []).slice(-8) })}\n\nWat is de beste volgende stap om dit dossier dichter bij een opdracht te brengen? Antwoord als JSON: {"actie": korte actie (max 8 woorden), "datum": "YYYY-MM-DD" (realistische datum vanaf vandaag, werkdag), "waarom": één zin}.`;
    try {
      const j = await sampleJson<{ actie?: string; datum?: string; waarom?: string }>(input);
      if (!j || !j.actie) throw new Error('leeg');
      setStap({
        busy: false,
        data: { actie: String(j.actie), datum: String(j.datum || plusDagen(2)).slice(0, 10), waarom: String(j.waarom || '') },
      });
    } catch (e) {
      setStap({ busy: false, err: aiFout(e) });
    }
  }

  async function kopieerMail() {
    try {
      await navigator.clipboard.writeText(mail?.text || '');
      toast('Mail gekopieerd');
    } catch {
      toast('Kopiëren lukte niet; selecteer de tekst handmatig');
    }
  }

  async function verwijderDossier() {
    if (!D.id) return;
    if (await verwijder('leads', D.id)) {
      toast('Dossier verwijderd');
      sluitLade();
    }
  }

  const syntessBestaat = !!(D.syntessId && d.syntess.some((x) => x.id === D.syntessId));

  return (
    <>
      <div className="scrim" onClick={sluitLade} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Dossier">
        <div className="dr-h">
          <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: f.k, boxShadow: `0 0 12px ${f.k}` }} />
          <h3>{D.bedrijf || 'Nieuwe lead'}</h3>
          <button className="btn ghost sm" onClick={sluitLade} aria-label="Sluiten">
            ✕
          </button>
        </div>
        <div className="dr-b">
          <div>
            <span className="lbl">Fase</span>
            <div className="stages">
              {FASEN.map((x) => (
                <button
                  key={x.id}
                  aria-pressed={D.fase === x.id}
                  style={D.fase === x.id ? { background: x.k, borderColor: x.k } : undefined}
                  onClick={() => setD((y) => ({ ...y, fase: x.id as FaseId, kans: FASE[x.id].p }))}
                >
                  {x.n}
                </button>
              ))}
            </div>
          </div>
          <div className="fields">
            <div className="full">
              <label className="lbl" htmlFor="d-bedrijf">Bedrijf</label>
              <input ref={bedrijfRef} className="input" id="d-bedrijf" value={D.bedrijf || ''} onChange={(e) => upd('bedrijf', e.target.value)} />
            </div>
            {kl && (
              <div className="full" style={{ marginTop: -6 }}>
                <span className="chip ok">Bestaande klant: {kl.naam}</span>
              </div>
            )}
            <div>
              <label className="lbl" htmlFor="d-contact">Contactpersoon</label>
              <input className="input" id="d-contact" value={D.contact || ''} onChange={(e) => upd('contact', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-plaats">Plaats</label>
              <input className="input" id="d-plaats" value={D.plaats || ''} onChange={(e) => upd('plaats', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-email">E-mail</label>
              <input className="input" id="d-email" type="email" value={D.email || ''} onChange={(e) => upd('email', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-tel">Telefoon</label>
              <input className="input" id="d-tel" type="tel" value={D.tel || ''} onChange={(e) => upd('tel', e.target.value)} />
            </div>
            <div className="full">
              <label className="lbl" htmlFor="d-oms">Wat willen ze</label>
              <textarea className="input" id="d-oms" rows={2} value={D.omschrijving || ''} onChange={(e) => upd('omschrijving', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-sector">Sector</label>
              <select className="input" id="d-sector" value={D.sector || ''} onChange={(e) => upd('sector', e.target.value)}>
                <option value="">Onbekend</option>
                {SECTOREN.map((s) => (
                  <option key={s.id} value={s.id}>{s.n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="d-eig">Eigenaar</label>
              <select className="input" id="d-eig" value={D.eigenaar || ''} onChange={(e) => upd('eigenaar', e.target.value)}>
                <option value="">—</option>
                {d.team.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="d-waarde">Waarde (€ excl. btw)</label>
              <input
                className="input"
                id="d-waarde"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={D.waarde || ''}
                onChange={(e) => upd('waarde', e.target.value === '' ? 0 : +e.target.value)}
              />
            </div>
            <div>
              <label className="lbl" htmlFor="d-kans">Kans (%)</label>
              <input
                className="input"
                id="d-kans"
                type="number"
                min={0}
                max={100}
                step={5}
                value={D.kans != null ? D.kans : f.p}
                onChange={(e) => upd('kans', e.target.value === '' ? undefined : +e.target.value)}
              />
            </div>
            <div>
              <label className="lbl" htmlFor="d-offnr">Offertenummer</label>
              <input className="input" id="d-offnr" value={D.offertenr || ''} onChange={(e) => upd('offertenr', e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="d-bron">Bron</label>
              <select className="input" id="d-bron" value={D.bron || ''} onChange={(e) => upd('bron', e.target.value)}>
                {BRONNEN.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="full" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span className="lbl">Volgende stap</span>
            </div>
            <div>
              <label className="lbl" htmlFor="d-actie">Actie</label>
              <input
                className="input"
                id="d-actie"
                value={D.volgendeActie || ''}
                placeholder="Bijv. offerte nabellen"
                onChange={(e) => upd('volgendeActie', e.target.value)}
              />
            </div>
            <div>
              <label className="lbl" htmlFor="d-datum">Datum</label>
              <input className="input" id="d-datum" type="date" value={D.volgendeDatum || ''} onChange={(e) => upd('volgendeDatum', e.target.value)} />
            </div>
          </div>

          {d.claude && !isNew && (
            <div
              className="stack"
              style={{ gap: 10, padding: 14, borderRadius: 14, border: '1px solid rgba(144,133,233,.3)', background: 'rgba(144,133,233,.06)' }}
            >
              <div className="row">
                <Spark />
                <b>Claude</b>
              </div>
              <div className="row">
                <button className="btn ai sm" onClick={aiMail} disabled={!!mail?.busy}>Schrijf opvolgmail</button>
                <button className="btn ai sm" onClick={aiStap} disabled={!!stap?.busy}>Stel volgende stap voor</button>
              </div>
              {stap && (
                <>
                  <div className="ai-out">
                    {stap.busy && !stap.data ? (
                      <>
                        <Spin /> Denkt na…
                      </>
                    ) : stap.err ? (
                      stap.err
                    ) : stap.data ? (
                      <>
                        <b>{stap.data.actie}</b> · {datumNL(stap.data.datum)}
                        <br />
                        {stap.data.waarom}
                      </>
                    ) : null}
                  </div>
                  {stap.data && (
                    <div>
                      <button
                        className="btn sm"
                        onClick={() => {
                          setD((x) => ({ ...x, volgendeActie: stap.data!.actie, volgendeDatum: stap.data!.datum }));
                          toast('Overgenomen, vergeet niet op te slaan');
                        }}
                      >
                        Neem over als volgende stap
                      </button>
                    </div>
                  )}
                </>
              )}
              {mail && (
                <>
                  <div
                    className="ai-out"
                    style={{ whiteSpace: 'pre-wrap', background: '#0f0f0e', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--line)' }}
                  >
                    {mail.text || (
                      <>
                        <Spin /> Schrijft…
                      </>
                    )}
                  </div>
                  {mail.text && !mail.busy && (
                    <div className="row">
                      <button className="btn sm" onClick={kopieerMail}>Kopieer</button>
                      {D.email && <span className="sub" style={{ margin: 0 }}>Aan: {D.email}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            <label className="lbl" htmlFor="d-note" style={{ margin: 0 }}>Notitie of contactmoment toevoegen</label>
            <textarea
              className="input"
              id="d-note"
              rows={2}
              placeholder="Bijv. gebeld met inkoper, beslissing volgende week"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div>
              <button className="btn sm" onClick={voegNotitieToe}>+ Voeg toe aan logboek</button>
            </div>
            <div className="log">
              {(D.log || []).length ? (
                (D.log || [])
                  .slice()
                  .reverse()
                  .map((x, i) => (
                    <div key={i}>
                      <small>
                        {datumNL(x.d)}
                        {x.w ? ' · ' + x.w : ''}
                      </small>
                      {x.t}
                    </div>
                  ))
              ) : (
                <span className="muted" style={{ fontSize: 12.5 }}>Nog geen contactmomenten.</span>
              )}
            </div>
          </div>
        </div>
        <div className="dr-f">
          <button className="btn pri" onClick={opslaan} disabled={bezig}>
            {isNew ? 'Lead aanmaken' : 'Opslaan'}
          </button>
          {!isNew && syntessBestaat && (
            <button
              className="btn"
              onClick={() => {
                sluitLade();
                gaNaar('syntess');
                void openSyntessOfferte(D.syntessId!);
              }}
            >
              Offerte (Syntess)
            </button>
          )}
          <button className="btn ghost" onClick={sluitLade}>Annuleer</button>
          {!isNew && (
            <>
              <span style={{ marginLeft: 'auto' }} />
              {zeker ? (
                <>
                  <span className="sub" style={{ margin: 0 }}>Zeker weten?</span>
                  <button className="btn danger sm" onClick={verwijderDossier}>Ja, verwijder</button>
                  <button className="btn ghost sm" onClick={() => setZeker(false)}>Nee</button>
                </>
              ) : (
                <button className="btn ghost sm" onClick={() => setZeker(true)}>Verwijder</button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
