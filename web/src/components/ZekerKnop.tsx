import { useEffect, useState } from 'react';

/** Knop die eerst om bevestiging vraagt (3 seconden geldig). */
export function ZekerKnop({ onBevestig, label }: { onBevestig: () => void; label: string }) {
  const [zeker, setZeker] = useState(false);
  useEffect(() => {
    if (!zeker) return;
    const t = setTimeout(() => setZeker(false), 3000);
    return () => clearTimeout(t);
  }, [zeker]);
  return (
    <button
      className={'btn sm ' + (zeker ? 'danger' : 'ghost')}
      aria-label={label}
      onClick={() => (zeker ? onBevestig() : setZeker(true))}
    >
      {zeker ? 'Zeker?' : '✕'}
    </button>
  );
}
