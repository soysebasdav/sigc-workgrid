import { useEffect } from 'react';
import landingHtml from '../../assets/orkesta-landing.html?raw';

export function OrkestaHomePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const previousOverflow = document.body.style.overflow;
    document.title = 'Orkesta — Coordina procesos, casos y equipos';
    document.body.style.overflow = 'hidden';

    return () => {
      document.title = previousTitle;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <main className="orkesta-home-page" aria-label="Página de inicio de Orkesta">
      <iframe
        className="orkesta-home-frame"
        srcDoc={landingHtml}
        title="Orkesta — Coordina procesos, casos y equipos"
      />
    </main>
  );
}
