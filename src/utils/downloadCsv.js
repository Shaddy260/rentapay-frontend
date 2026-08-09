// src/utils/downloadCsv.js
//
// Shared "download as a document" utility for Payment History and any
// other financial list, per direct request ("anywhere there is
// finances involved... should just be downloaded"). Kept as a plain
// client-side CSV export (no new dependency, works offline, opens
// cleanly in Excel/Sheets/Numbers) rather than pulling in a PDF
// library - this environment has no network access to install one,
// and a client-side CSV keeps things fast with zero added weight.

/**
 * @param {string} filename - without extension, e.g. "payment-history"
 * @param {string[]} headers
 * @param {Array<Array<string|number>>} rows
 */
export function downloadCsv(filename, headers, rows) {
  const escapeCell = (cell) => {
    const str = String(cell ?? '');
    // Quote any cell containing a comma, quote, or newline, doubling
    // internal quotes - standard CSV escaping so names/notes with
    // commas in them don't silently corrupt the columns.
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  const csv = lines.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
