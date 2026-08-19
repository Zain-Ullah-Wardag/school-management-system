export type PrintOrientation = 'portrait' | 'landscape';

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));

export function buildPrintDocument(content: string, title = 'School ERP Report', orientation: PrintOrientation = 'portrait') {
  const base = window.desktop?.isElectron ? 'http://127.0.0.1:3299/' : `${window.location.origin}/`;
  const pageSize = orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${base}">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    @page { size: ${pageSize}; margin: 12mm; }
    :root { color: #17211d; background: #eef2ef; font-family: Arial, Helvetica, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-size: 12px; }
    .print-toolbar { position: sticky; top: 0; z-index: 20; display: flex; justify-content: flex-end; gap: 8px; max-width: ${orientation === 'landscape' ? '1120px' : '840px'}; margin: 0 auto 16px; }
    .print-toolbar button { border: 0; border-radius: 8px; padding: 10px 14px; font: 700 13px Arial, sans-serif; cursor: pointer; color: white; background: #0b8c51; }
    .print-toolbar button:last-child { color: #334155; background: #e2e8f0; }
    .print-page { width: 100%; max-width: ${orientation === 'landscape' ? '1120px' : '840px'}; min-height: ${orientation === 'landscape' ? '760px' : '1120px'}; margin: 0 auto; padding: 12mm; background: white; box-shadow: 0 12px 42px rgba(15, 39, 26, .16); }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin-bottom: 4px; }
    h3 { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 7px; border: 1px solid #d8e1dc; text-align: left; vertical-align: top; }
    th { background: #edf7f1; color: #173d2a; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 2px solid #0b8c51; padding-bottom: 10px; margin-bottom: 14px; }
    .muted { color: #64748b; }
    .right { text-align: right; }
    .center { text-align: center; }
    img { max-width: 100%; }
    @media print {
      :root, body { background: white; }
      body { padding: 0; }
      .print-toolbar { display: none !important; }
      .print-page { max-width: none; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <button type="button" onclick="window.print()">Print / Save PDF</button>
    <button type="button" onclick="window.close()">Close</button>
  </div>
  <main class="print-page">${content}</main>
</body>
</html>`;
}

function openBrowserPreview(documentHtml: string) {
  // Do not use noopener here. It makes some Chromium implementations return a
  // disconnected window, which was the source of the blank print previews.
  const preview = window.open('about:blank', '_blank', 'popup,width=1120,height=860');
  if (preview) {
    preview.document.open();
    preview.document.write(documentHtml);
    preview.document.close();
    preview.focus();
    window.setTimeout(() => preview.print(), 450);
    return;
  }

  // Popup-blocker fallback: render a real document in a temporary iframe and
  // invoke the native browser print preview rather than leaving a blank page.
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'School ERP print preview');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(documentHtml);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1_500);
  }, 450);
}

export function printHtml(content: string, title = 'School ERP Report', orientation: PrintOrientation = 'portrait') {
  const documentHtml = buildPrintDocument(content, title, orientation);
  if (window.desktop?.isElectron) {
    void window.desktop.openPrintPreview(documentHtml, title, orientation === 'landscape');
    return;
  }
  openBrowserPreview(documentHtml);
}

export function exportPdfHtml(content: string, title = 'School ERP Report', orientation: PrintOrientation = 'portrait') {
  const documentHtml = buildPrintDocument(content, title, orientation);
  if (window.desktop?.isElectron) return window.desktop.savePdf(documentHtml, `${title.replace(/\s+/g, '-').toLowerCase()}.pdf`, orientation === 'landscape');
  openBrowserPreview(documentHtml);
  return Promise.resolve({ canceled: false });
}
