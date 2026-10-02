function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Safari can produce an empty PDF when it prints a dynamically rendered SPA.
 * Print a stable copy of the completed document in its own window instead.
 */
export function printDocumentElement(elementId: string, title: string) {
  const source = window.document.getElementById(elementId);
  if (!source) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=900');
  if (!printWindow) {
    window.print();
    return;
  }

  const styles = Array.from(window.document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => (link as HTMLLinkElement).href)
    .filter(Boolean)
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
    .join('');
  const markup = source.outerHTML;
  const safeTitle = escapeHtml(title);

  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${escapeHtml(window.location.origin)}/"><title>${safeTitle}</title>${styles}<style>@page{margin:12mm}html,body{margin:0;background:#fff;color:#29231f}#${elementId}{width:100%}.print\\:hidden{display:none!important}</style></head><body>${markup}</body></html>`);
  printWindow.document.close();

  let printed = false;
  const printWhenReady = () => {
    if (printed) return;
    printed = true;
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };
  printWindow.addEventListener('load', printWhenReady, { once: true });
  // A newly written document does not consistently fire `load` in Safari.
  window.setTimeout(printWhenReady, 700);
}
