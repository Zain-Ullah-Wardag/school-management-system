import * as XLSX from 'xlsx';

export function exportExcel(rows: Record<string, unknown>[], fileName: string, sheetName = 'Report') {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, `${fileName}.xlsx`);
}

export function exportCsv(rows: Record<string, unknown>[], fileName: string) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.map(quote).join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
