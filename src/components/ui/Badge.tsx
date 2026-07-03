import type { ReactNode } from 'react';

type BadgeTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
