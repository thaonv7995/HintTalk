import { useEffect, useState } from 'react';

export function TechnicalLog({ lines, title = 'Technical log' }: { lines: string[]; title?: string }) {
  return (
    <details className="technical-log details-debug">
      <summary>{title}</summary>
      <pre>{lines.length ? lines.join('\n') : 'No events yet.'}</pre>
    </details>
  );
}

/** MM:SS elapsed since startedAt when active */
export function PracticeTimerBar({ active, startedAt }: { active: boolean; startedAt: number | null }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!active || !startedAt) {
      setSec(0);
      return;
    }
    const tick = () => setSec(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);

  if (!active || !startedAt) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <span className="practice-timer">
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}
