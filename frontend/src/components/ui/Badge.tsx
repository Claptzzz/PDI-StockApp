import type { ReactNode } from 'react';

export type BadgeTone =
  'navy' | 'blue' | 'sky' | 'terracota' | 'ambar' | 'success' | 'danger' | 'gray';

const TONES: Record<BadgeTone, string> = {
  navy: 'bg-navy/10 text-navy',
  blue: 'bg-blue/10 text-blue',
  sky: 'bg-sky/20 text-blue',
  terracota: 'bg-terracota/10 text-terracota',
  ambar: 'bg-ambar/20 text-ocre',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  gray: 'bg-gray-200 text-gray-600',
};

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
