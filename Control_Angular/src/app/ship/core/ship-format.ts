export function usd(value: number | null | undefined, digits = 0): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

export function fmt(value: number | null | undefined, digits = 0): string {
  return Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function stars(avg: number | null): { on: number; off: number } {
  const on = Math.round(avg ?? 0);
  return { on, off: 5 - on };
}

/** تنزيل CSV بسيط (UTF-8 مع BOM علشان Excel يقرا العربي). */
export function downloadCsv(name: string, rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
