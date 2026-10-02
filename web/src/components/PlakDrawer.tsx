import { useEffect, useRef, useState } from 'react';
import { CONTEXT, FASE, SEC, SECTOREN } from '../lib/constants';
import { aiFout, sampleJson } from '../lib/claude';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { FaseId } from '../lib/types';
import { openLade, sluitLade } from '../lib/ui';
import { vandaag } from '../lib/utils';
import { Spark, Spin } from './Spark';

interface Parsed {
  bedrijf?: string;
  contact?: string;
  email?: string;
  tel?: string;
  plaats?: string;
  sector?: string;
  fase?: string;
  omschrijving?: string;
  waarde?: number | null;
  volgendeActie?: string;
  volgendeDatum?: string;
  notitie?: string;
}

function prompt(txt: string): string {
  return `${CONTEXT}\n\nHaal uit onderstaande tekst (een e-mail, belnotitie of aanvraag) de gegevens voor een nieuw sales-dossier. Vandaag is ${vandaag()}.\nSector kies uit: ${SECTOREN.map((s) => s.id + ' (' + s.n + ')').join(', ')}, of "".\nFase kies uit: lead, aanvraag, bezoek, offerte, onderhandeling.\nAntwoord als JSON met: bedrijf, contact, email, tel, plaats, sector, fase, omschrijving (max 15 woorden, wat de klant wil), waarde (getal in euro of null), volgendeActie (max 8 woorden), volgendeDatum ("YYYY-MM-DD" of ""), notitie (samenvatting in 1-2 zinnen). Laat onbekende velden leeg. Verzin niets.\n\nTekst:\n"""${txt.slice(0, 12000)}"""`;
}

export function PlakDrawer() {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  async function go() {
    const t = txt.trim();
    if (!t) {
      toast('Plak eerst een tekst');
      return;
    }
    setBusy(true);
    setFout('');
    try {
      const j = (await sampleJson<Parsed>(prompt(t))) || {};
      const fase: FaseId = j.fase && j.fase in FASE ? (j.fase as FaseId) : 'aanvraag';
      const me = getMe();
      openLade({
        fase,
        kans: FASE[fase].p,
        bedrijf: j.bedrijf || '',
        contact: j.contact || '',
        email: j.email || '',
        tel: j.tel || '',
        plaats: j.plaats || '',
        sector: j.sector && SEC[j.sector] ? j.sector : '',
        omschrijving: j.omschrijving || '',
        waarde: +(j.waarde ?? 0) || 0,
        volgendeActie: j.volgendeActie || '',
        volgendeDatum: /^\d{4}-\d{2}-\d{2}$/.test(j.volgendeDatum || '') ? j.volgendeDatum : '',
        eigenaar: me,
        bron: /@/.test(t) ? 'E-mail' : '',
        log: j.notitie ? [{ d: vandaag(), t: j.notitie, w: me }] : [],
      });
      toast('Controleer de gegevens en sla op');
    } catch (e) {
      setBusy(false);
      setFout(aiFout(e));
    }
  }

  return (
    <>
      <div className="scrim" onClick={sluitLade} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Plak mail">
        <div className="dr-h">
          <h3>Plak mail of notitie</h3>
          <button className="btn ghost sm" onClick={sluitLade} aria-label="Sluiten">
            ✕
          </button>
        </div>
        <div className="dr-b">
          <div className="sub">
            Plak een aanvraag, een doorgestuurde mail of je aantekeningen na een klantbezoek. Claude vult het dossier in; jij
            controleert en slaat op.
          </div>
          <textarea
            ref={ref}
            className="input"
            rows={12}
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            placeholder={'Van: ...\nOnderwerp: aanvraag afzuiging lasafdeling...'}
          />
        </div>
        <div className="dr-f">
          <button className="btn ai" onClick={go} disabled={busy}>
            <Spark />
            Vul dossier in
          </button>
          <button className="btn ghost" onClick={sluitLade}>
            Annuleer
          </button>
          <span className="sub" style={{ margin: 0 }}>
            {busy ? (
              <>
                <Spin /> Claude leest mee…
              </>
            ) : (
              fout
            )}
          </span>
        </div>
      </div>
    </>
  );
}
