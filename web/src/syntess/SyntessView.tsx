import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Spark, Spin } from '../components/Spark';
import { faseVan } from '../lib/constants';
import { useData } from '../lib/dataStore';
import { toast } from '../lib/toast';
import type { SyntessOfferte } from '../lib/types';
import { openLade } from '../lib/ui';
import { eurK } from '../lib/utils';
import { ST_INFO, controlePunten } from './analyse';
import { tekenVoorbeeld } from './preview';
import {
  herbouw,
  importeerBibliotheek,
  importeerKennis,
  lib,
  syChat,
  syExport,
  syGewijzigd,
  syKoppel,
  syOpen,
  sySluit,
  syUpload,
  syZetStatus,
  useSy,
  zetSy,
  getSy,
  type SyMenu,
} from './syStore';

const START = [
  'Loop de offerte met me door',
  'Stel de systeemomschrijving voor',
  'Welke artikelen missen nog iets?',
  'Controleer de offerte op onjuistheden',
];
const START_VOLLEDIG = [
  'Loop de offerte met me door: wat ontbreekt er nog en wat moet ik nakijken?',
  'Stel de systeemomschrijving voor op basis van de artikelen en vraag wat je mist.',
  'Welke artikelen missen nog tekst of een afbeelding, en wat stel je voor?',
  'Controleer de hele offerte inhoudelijk op onjuistheden en tegenstrijdigheden. Meld alleen, wijzig niets aan wat Syntess aanlevert.',
];

function Kennisregel() {
  const d = useData();
  const sy = useSy();
  const L = lib();
  const nArt = L.filter((e) => e.kind !== 'media').length;
  const nMed = L.filter((e) => e.kind === 'media').length;
  const K = d.kennis;
  return (
    <div className="row" style={{ gap: 8 }}>
      {K ? (
        <span className="chip ok">
          Project “Offerte Tool” · gesynchroniseerd{' '}
          {K.gesynchroniseerd
            ? new Date(K.gesynchroniseerd).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : ''}
        </span>
      ) : (
        <span className="chip today">Nog geen kennis uit het project</span>
      )}
      <span className="chip">{nArt} artikelen in bibliotheek</span>
      <span className="chip">{nMed} afbeeldingen/tekeningen</span>
      {sy.bibBusy && (
        <span className="chip">
          <Spin /> bibliotheek laden…
        </span>
      )}
      {sy.bibErr && <span className="chip late">{sy.bibErr}</span>}
    </div>
  );
}

function LeadChip({ leadId }: { leadId?: string }) {
  const d = useData();
  const l = leadId ? d.leads.find((y) => y.id === leadId) : null;
  if (!l) return null;
  const f = faseVan(l.fase);
  return (
    <span className="chip">
      <i style={{ background: f.k }} />
      {f.n}
    </span>
  );
}

function Startpagina() {
  const d = useData();
  const sy = useSy();
  const lijst = d.syntess.slice().sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="card stack" style={{ gap: 14 }}>
        <div>
          <h2>Offerte maken uit een Syntess-calculatie</h2>
          <div className="sub">
            Upload de Word-export uit Syntess. Per artikelregel worden de standaardtekst en afbeelding aangevuld, Claude stelt de
            systeemomschrijving voor en de tool controleert klant, datum en projectleider. Wat Syntess aanlevert blijft ongewijzigd.
          </div>
        </div>
        <Kennisregel />
        <div className="row">
          <label className="btn pri file-btn">
            Upload Syntess-export (.docx)
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                void syUpload(e.target.files?.[0], false);
                e.target.value = '';
              }}
            />
          </label>
          {sy.busy && (
            <span className="sub" style={{ margin: 0 }}>
              <Spin /> Inlezen…
            </span>
          )}
          {sy.fout && <span className="chip late">{sy.fout}</span>}
        </div>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <div>
          <h2>Kennis en bibliotheek</h2>
          <div className="sub">
            De kennis komt uit het project <b className="soft">Offerte Tool</b>: huisstijl, werkwijze, standaardteksten en de bibliotheek
            met afbeeldingen. Importeer de export hier; het hele team gebruikt daarna dezelfde versie.
          </div>
        </div>
        <div className="row">
          <label className="btn file-btn">
            Importeer kennis (.json of Standaardteksten.md)
            <input
              type="file"
              accept=".json,.md,application/json,text/markdown"
              onChange={(e) => {
                void importeerKennis(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <label className="btn file-btn">
            Importeer bibliotheek (.json)
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void importeerBibliotheek(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>Eerdere offertes</h2>
        {lijst.length ? (
          <div className="calc-list">
            {lijst.map((x) => (
              <button key={x.id} className="sec" onClick={() => void syOpen(x)}>
                <div className="h">{x.samenvatting?.klant || x.naam}</div>
                <div className="e">
                  {x.samenvatting?.ref || ''} · {x.bestand || ''}
                </div>
                <div className="n">
                  <span className={'chip ' + (x.status === 'klaar' ? 'ok' : '')}>{x.status || 'concept'}</span>
                  {x.samenvatting && (
                    <span className="chip">
                      {x.samenvatting.aangevuld}/{x.samenvatting.artikelen} aangevuld
                    </span>
                  )}
                  <LeadChip leadId={x.leadId} />
                  {x.door && <span className="chip">{x.door}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">Nog geen offertes uit Syntess.</div>
        )}
      </section>
    </div>
  );
}

function Kop({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const res = sy.res;
  const l = c.leadId ? d.leads.find((x) => x.id === c.leadId) : null;
  const f = l ? faseVan(l.fase) : null;
  return (
    <div className="row between">
      <div className="row" style={{ gap: 12 }}>
        <button className="btn ghost sm" onClick={() => void sySluit()}>
          ← Alle offertes
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{c.naam}</div>
          <div className="sub" style={{ margin: 0 }}>
            {res ? `${res.rap.ingevoegd.length} van ${res.arts.length} artikelen aangevuld` : ''}
            {sy.base ? '' : ' · Word-bestand nog niet geladen'}
          </div>
        </div>
      </div>
      <div className="row">
        {l && f ? (
          <button
            className="chip"
            title="Open dossier in de pipeline"
            style={{ border: 'none', cursor: 'pointer', padding: '6px 11px' }}
            onClick={() => openLade(l)}
          >
            <i style={{ background: f.k }} />
            Pipeline · {l.bedrijf} · {f.n}
            {l.waarde ? ' · ' + eurK(l.waarde) : ''}
          </button>
        ) : res ? (
          <button className="btn sm" onClick={() => void syKoppel()}>
            + Zet in pipeline
          </button>
        ) : null}
        {c.status !== 'verstuurd' && res && (
          <button className="btn sm" onClick={() => void syZetStatus('verstuurd')}>
            Markeer als verstuurd
          </button>
        )}
        <select
          className="input"
          style={{ width: 'auto' }}
          aria-label="Status"
          value={c.status}
          onChange={(e) => void syZetStatus(e.target.value as SyntessOfferte['status'])}
        >
          {['concept', 'klaar', 'verstuurd'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn pri" disabled={!res || sy.expBusy} onClick={() => void syExport()}>
          {sy.expBusy && <Spin />}Download Word
        </button>
      </div>
    </div>
  );
}

function Chat({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const res = sy.res;
  const [tekst, setTekst] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLTextAreaElement>(null);
  const open = res ? res.arts.filter((a) => ['onbekend', 'twijfel'].includes(a.s.st)).length : 0;
  const lo = controlePunten(res?.doc, c.bestand).filter((x) => x[0] === 'LET OP').length;

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [c.chat.length, sy.chatBusy]);

  useEffect(() => {
    if (!sy.chatBusy) inRef.current?.focus();
  }, [sy.chatBusy]);

  function stuur() {
    const t = tekst.trim();
    if (!t || sy.chatBusy) return;
    setTekst('');
    void syChat(t);
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <Spark />
        <b>Claude-assistent</b>
        <span className="sub" style={{ margin: 0 }}>
          vraagt door, vult aan en controleert · {open} open artikel{open === 1 ? '' : 'en'} · {lo} aandachtspunt{lo === 1 ? '' : 'en'}
        </span>
      </div>
      {d.claude ? (
        <>
          <div className="chat" ref={chatRef}>
            {c.chat.length ? (
              c.chat.map((m, i) => (
                <div key={i} className={'msg ' + (m.r === 'u' ? 'u' : 'c')}>
                  {m.t}
                  {m.wijz && (
                    <div className="sub" style={{ marginTop: 6, color: '#c9c2ff' }}>
                      {m.wijz}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="sub">
                Kies hieronder waar je wilt beginnen, of typ je vraag of aanvulling. Claude gebruikt de huisstijl en werkwijze uit het
                project Offerte Tool en verzint geen productteksten.
              </div>
            )}
            {sy.chatBusy && (
              <div className="msg c">
                <Spin /> Claude denkt na…
              </div>
            )}
          </div>
          {!sy.chatBusy && c.opties && c.opties.length > 0 ? (
            <div className="opts">
              {c.opties.map((o, i) => (
                <button key={i} onClick={() => void syChat(o)}>
                  {o}
                </button>
              ))}
            </div>
          ) : !c.chat.length ? (
            <div className="opts">
              {START.map((o, i) => (
                <button key={i} onClick={() => void syChat(START_VOLLEDIG[i])}>
                  {o}
                </button>
              ))}
            </div>
          ) : null}
          <div className="composer">
            <textarea
              ref={inRef}
              className="input"
              rows={2}
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  stuur();
                }
              }}
              placeholder="Bijv. de installatie staat binnen, capaciteit 4.000 m3/h… (Enter = versturen)"
            />
            <button className="btn pri" onClick={stuur} disabled={sy.chatBusy}>
              Stuur
            </button>
          </div>
        </>
      ) : (
        <div className="empty">
          Claude is niet ingesteld op de server (ANTHROPIC_API_KEY). De artikelen, systeemomschrijving en controle werken wel.
        </div>
      )}
    </div>
  );
}

let tEigen: ReturnType<typeof setTimeout> | undefined;
let tInl: ReturnType<typeof setTimeout> | undefined;

function Artikelen({ c }: { c: SyntessOfferte }) {
  const sy = useSy();
  const res = sy.res;
  if (!res) return null;
  const opties = lib()
    .filter((e) => e.kind !== 'media')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  function kies(ev: MouseEvent<HTMLDivElement>, k: string) {
    if ((ev.target as HTMLElement).closest('select,textarea,option')) return;
    zetSy({ sel: k });
    requestAnimationFrame(() => {
      const el = document.querySelector(`#sy-pages [data-syk="${k}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      else toast('Voor dit artikel wordt niets ingevoegd');
    });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="sub">
        Per dikgedrukte artikelregel uit Syntess. Automatisch = exacte match uit de bibliotheek. Productteksten komen alleen uit de
        bibliotheek of van jou, nooit van Claude.
      </div>
      {res.arts.map((a, i) => {
        const s = a.s;
        const k = c.keuzes[i] || 'auto';
        const [lab, cls] = ST_INFO[s.st] || [s.st, ''];
        return (
          <div key={i} className={'sy-art' + (sy.sel === 'a' + i ? ' sel' : '')} onClick={(ev) => kies(ev, 'a' + i)}>
            <div className="row between" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <div style={{ minWidth: 0 }}>
                <div className="b" style={{ fontWeight: 700, fontSize: 13 }}>
                  {a.regel}
                </div>
                <div className="sub" style={{ margin: '2px 0 0' }}>
                  {s.e ? 'Bibliotheek: ' + s.e.name : ''}
                  {s.info ? (s.e ? ' · ' : '') + s.info : ''}
                </div>
              </div>
              <span className={'chip ' + cls}>{lab}</span>
            </div>
            {!(a.klaar || s.st === 'heeft_al_inhoud') && (
              <>
                <div className="row" style={{ marginTop: 8, gap: 8 }}>
                  <select
                    className="input"
                    style={{ flex: '1 1 220px', width: 'auto' }}
                    aria-label={'Keuze voor ' + a.regel}
                    value={k}
                    onChange={(e) => {
                      c.keuzes[i] = e.target.value;
                      herbouw();
                      syGewijzigd();
                    }}
                  >
                    <option value="auto">Automatisch</option>
                    <option value="leeg">Niets toevoegen</option>
                    {!a.txt && <option value="eigen">Eigen tekst typen</option>}
                    <optgroup label="Bibliotheek">
                      {opties.map((n) => (
                        <option key={n} value={'lib:' + n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {k === 'eigen' && (
                  <textarea
                    className="input"
                    rows={3}
                    style={{ marginTop: 8 }}
                    placeholder="Jouw tekst (regels met - worden een opsomming)"
                    value={c.eigen[i] || ''}
                    onChange={(e) => {
                      c.eigen[i] = e.target.value;
                      zetSy({});
                      clearTimeout(tEigen);
                      tEigen = setTimeout(() => {
                        herbouw();
                        syGewijzigd();
                      }, 600);
                    }}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Inleiding({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const med = lib().filter((e) => e.kind === 'media');

  function voegToe(stuk: string) {
    c.inleiding = (c.inleiding || '').replace(/\s*$/, '') + stuk;
    herbouw();
    syGewijzigd();
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="sub">
        Komt onder de kop <b className="soft">Systeemomschrijving</b>, opbouw volgens de huisstijl: intro-zin, positietabel, capaciteit,
        opstelling, besturing, foto met onderschrift. Je kunt ook direct in de voorbeeldweergave typen.
      </div>
      <div className="row" style={{ gap: 8 }}>
        {d.claude && (
          <button
            className="btn ai sm"
            disabled={sy.chatBusy}
            onClick={() => void syChat('Stel de systeemomschrijving voor op basis van de artikelen en vraag wat je mist.')}
          >
            <Spark />
            Laat Claude voorstellen
          </button>
        )}
        <button
          className="btn sm"
          onClick={() =>
            voegToe(
              '\n\n| Positie: | Aantal | Aansluitmaat | Totaal cap. [ m3/h ] |\n|---|---|---|---|\n| **[positie]** | **[aantal]** st. | Ø**[maat]**mm | **[capaciteit]** m3/h |\n',
            )
          }
        >
          + Positietabel
        </button>
        <button className="btn sm" onClick={() => voegToe('\n---pagina---\n')}>
          + Nieuwe pagina
        </button>
        {med.length > 0 && (
          <select
            className="input"
            style={{ width: 'auto', flex: '1 1 200px', maxWidth: '100%', minWidth: 0 }}
            aria-label="Afbeelding"
            value=""
            onChange={(e) => {
              if (e.target.value) voegToe('\n\n[[' + e.target.value + ']]\n');
            }}
          >
            <option value="">+ Afbeelding/tekening…</option>
            {med.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} – {m.omschrijving || ''}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        id="sy-inl"
        className="input"
        rows={14}
        style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5 }}
        placeholder="In deze offerte treft u een … aan t.b.v. onderstaande posities:"
        value={c.inleiding || ''}
        onChange={(e) => {
          c.inleiding = e.target.value;
          zetSy({});
          clearTimeout(tInl);
          tInl = setTimeout(() => {
            herbouw();
            syGewijzigd();
          }, 500);
        }}
      />
      <div className="sub">
        Syntax: elke regel = alinea · lege regel = witregel · <code>| a | b |</code> = tabel · <code>**vet**</code> = keuze ·{' '}
        <code>*cursief*</code> · <code>[[Systeemomschrijving 1]]</code> = afbeelding · <code>---pagina---</code>
      </div>
    </div>
  );
}

function Controle({ c }: { c: SyntessOfferte }) {
  const d = useData();
  const sy = useSy();
  const P = controlePunten(sy.res?.doc, c.bestand);
  const g = P.filter((x) => x[0] !== 'TEKST');
  const t = P.filter((x) => x[0] === 'TEKST');
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="sub">
        Alleen controle: klantgegevens, datum, projectleider en huisstijl komen uit Syntess en worden <b className="soft">niet</b>{' '}
        aangepast. Pas fouten aan in Syntess of in Word.
      </div>
      {g.map((x, i) => {
        const key = x[1] + x[2];
        const let_op = x[0] === 'LET OP';
        return (
          <label key={i} className={'sy-ctl ' + (let_op ? 'warn' : x[0] === 'OK' ? 'ok' : '')}>
            {let_op && (
              <input
                type="checkbox"
                checked={!!c.gezien[key]}
                onChange={(e) => {
                  c.gezien[key] = e.target.checked;
                  syGewijzigd();
                }}
              />
            )}
            <span className={'chip ' + (let_op ? 'today' : x[0] === 'OK' ? 'ok' : '')}>{x[0]}</span>
            <span>
              <b>{x[1]}</b> · {x[2]}
            </span>
          </label>
        );
      })}
      <div className="lbl" style={{ marginTop: 6 }}>
        Tekstpunten ({t.length})
      </div>
      {t.length ? (
        t.map((x, i) => (
          <div key={i} className="sy-ctl">
            <span className="chip">{x[1]}</span>
            <span className="soft">{x[2]}</span>
          </div>
        ))
      ) : (
        <div className="sub">Geen tekstpunten gevonden.</div>
      )}
      {d.claude && (
        <div>
          <button className="btn ai sm" onClick={() => void syChat(START_VOLLEDIG[3])}>
            <Spark />
            Laat Claude ook inhoudelijk controleren
          </button>
        </div>
      )}
    </div>
  );
}

function Menu({ c }: { c: SyntessOfferte }) {
  const sy = useSy();
  const res = sy.res;
  const nLetOp = controlePunten(res?.doc, c.bestand).filter((x) => x[0] === 'LET OP').length;
  const nOpen = res ? res.arts.filter((a) => ['onbekend', 'twijfel'].includes(a.s.st)).length : 0;
  const tabs: [SyMenu, string][] = [
    ['vragen', 'Claude'],
    ['artikelen', 'Artikelen'],
    ['inleiding', 'Systeemomschrijving'],
    ['controle', 'Controle'],
  ];
  return (
    <section className="card stack" style={{ gap: 14 }}>
      <div className="seg" role="group" aria-label="Menu">
        {tabs.map(([k, n]) => (
          <button key={k} aria-pressed={sy.menu === k} onClick={() => zetSy({ menu: k })}>
            {n}
            {k === 'controle' && <span className="cnt"> {nLetOp || ''}</span>}
            {k === 'artikelen' && <span className="cnt"> {nOpen || ''}</span>}
          </button>
        ))}
      </div>
      {sy.menu === 'artikelen' ? (
        <Artikelen c={c} />
      ) : sy.menu === 'inleiding' ? (
        <Inleiding c={c} />
      ) : sy.menu === 'controle' ? (
        <Controle c={c} />
      ) : (
        <Chat c={c} />
      )}
    </section>
  );
}

function Voorbeeld() {
  const sy = useSy();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !sy.res || !sy.base) return;
    try {
      tekenVoorbeeld(host, sy.res, sy.base, { marks: sy.marks, sel: sy.sel });
    } catch (e) {
      host.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'empty';
      div.style.cssText = 'background:#fff;color:#333';
      div.textContent = 'Voorbeeld kon niet worden getekend: ' + (e instanceof Error ? e.message : String(e));
      host.appendChild(div);
    }
  }, [sy.res, sy.base, sy.marks, sy.sel]);

  function klik(ev: MouseEvent<HTMLDivElement>) {
    const blk = (ev.target as HTMLElement).closest<HTMLElement>('#sy-pages [data-syk]');
    if (!blk || blk.isContentEditable) return;
    const k = blk.dataset.syk || '';
    zetSy({ sel: k, menu: k === 'inl' ? 'inleiding' : 'artikelen' });
    requestAnimationFrame(() => document.querySelector(`.sy-art.sel`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function blur(ev: FocusEvent<HTMLDivElement>) {
    const t = ev.target as HTMLElement;
    const c = getSy().cur;
    if (!c || t.dataset.syl == null) return;
    const k = +t.dataset.syl;
    const L = String(c.inleiding || '').split('\n');
    if (k >= L.length) return;
    const oud = L[k];
    const nieuw = t.innerText.replace(/​/g, '').replace(/\n+/g, ' ').trim();
    const pref = oud.trim().startsWith('- ') ? '- ' : '';
    if (nieuw === oud.replace(/\*\*?/g, '').replace(/^- /, '').trim()) return;
    L[k] = pref + nieuw;
    c.inleiding = L.join('\n');
    herbouw();
    syGewijzigd();
  }

  function toets(ev: KeyboardEvent<HTMLDivElement>) {
    const t = ev.target as HTMLElement;
    if (t.dataset.syl != null && ev.key === 'Enter') {
      ev.preventDefault();
      t.blur();
    }
  }

  return (
    <section className="card stack" style={{ gap: 12, padding: 16 }}>
      <div className="row between">
        <div>
          <h2>Voorbeeld</h2>
          <div className="sub" style={{ margin: 0 }}>
            Klik een gemarkeerd blok om het te kiezen · typ in de paarse alinea’s · benadering van Word
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className={'btn sm ' + (sy.marks ? '' : 'ghost')} aria-pressed={sy.marks} onClick={() => zetSy({ marks: !sy.marks })}>
            Markeringen
          </button>
          <button
            className="btn sm ghost"
            aria-label="Uitzoomen"
            onClick={() => zetSy({ zoom: Math.max(0.4, Math.round((sy.zoom - 0.08) * 100) / 100) })}
          >
            −
          </button>
          <span className="sub" style={{ margin: 0 }}>
            {Math.round(sy.zoom * 100)}%
          </span>
          <button
            className="btn sm ghost"
            aria-label="Inzoomen"
            onClick={() => zetSy({ zoom: Math.min(1.2, Math.round((sy.zoom + 0.08) * 100) / 100) })}
          >
            +
          </button>
        </div>
      </div>
      <div className="row" style={{ gap: 10, fontSize: 11.5 }}>
        <span className="leg">
          <i style={{ background: '#2bb6a3' }} />
          Uit bibliotheek
        </span>
        <span className="leg">
          <i style={{ background: '#9085e9' }} />
          Claude (systeemomschrijving)
        </span>
        <span className="leg">
          <i style={{ background: '#fab219' }} />
          Eigen tekst
        </span>
        <span className="leg">
          <i style={{ background: '#c3c2b7' }} />
          Aangeleverd door Syntess (ongewijzigd)
        </span>
      </div>
      <div className="sy-view" onClick={klik} onBlur={blur} onKeyDown={toets}>
        <div id="sy-pages" ref={ref} style={{ zoom: sy.zoom }} />
      </div>
    </section>
  );
}

function Editor({ c }: { c: SyntessOfferte }) {
  const sy = useSy();
  if (!sy.base) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <Kop c={c} />
        <section className="card stack">
          {sy.busy ? (
            <div className="sub">
              <Spin /> Word-bestand ophalen…
            </div>
          ) : (
            <>
              <div className="banner">
                <div>Het Word-bestand van deze offerte is niet beschikbaar. Upload de Syntess-export opnieuw om verder te gaan.</div>
              </div>
              <div>
                <label className="btn file-btn">
                  Upload opnieuw
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(e) => {
                      void syUpload(e.target.files?.[0], true);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Kop c={c} />
      <Kennisregel />
      <div className="sy-grid">
        <div className="stack" style={{ gap: 16 }}>
          <Menu c={c} />
        </div>
        <div>
          <Voorbeeld />
        </div>
      </div>
    </div>
  );
}

export function SyntessView() {
  const sy = useSy();
  return sy.cur ? <Editor c={sy.cur} /> : <Startpagina />;
}
