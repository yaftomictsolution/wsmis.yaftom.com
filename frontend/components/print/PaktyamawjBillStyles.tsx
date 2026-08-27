'use client'

export function PaktyamawjBillStyles() {
  return (
    <style jsx global>{`
      @page { size: Letter portrait; margin: 0; }
      * { box-sizing: border-box; letter-spacing: 0; }
      html, body { margin: 0; padding: 0; }
      body { background: #e8edf2; }
      .paktyamawj-bill-print-root { min-height: 100vh; color: #310909; font-family: Tahoma, Arial, sans-serif; }
      .print-toolbar { position: sticky; top: 0; z-index: 20; display: flex; min-height: 56px; align-items: center; justify-content: space-between; border-bottom: 1px solid #d5dbe3; background: rgba(255,255,255,.97); padding: 8px 20px; color: #172033; box-shadow: 0 4px 16px rgba(15,23,42,.08); }
      .toolbar-title { margin: 0; font-size: 13px; font-weight: 900; }
      .toolbar-number { margin: 2px 0 0; color: #64748b; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; }
      .toolbar-actions { display: flex; align-items: center; gap: 8px; }
      .print-command, .close-command { display: inline-flex; height: 38px; align-items: center; justify-content: center; gap: 8px; border: 1px solid #305477; background: #fff; padding: 0 14px; color: #172033; font-weight: 800; cursor: pointer; }
      .print-command { background: #305477; color: #fff; }
      .close-command { width: 38px; padding: 0; }
      .bill-document { display: flex; justify-content: center; padding: 24px; }
      .bill-sheet { width: 215.9mm; height: 279.4mm; flex: 0 0 auto; overflow: hidden; background: #fff; box-shadow: 0 10px 30px rgba(15,23,42,.16); }
      .bill-frame { width: calc(100% - 22mm); height: calc(100% - 24mm); margin: 12mm 11mm; border: .45mm solid #161616; padding: 0 8mm 7mm; overflow: hidden; }
      .brand-header { display: block; width: 100%; height: 25mm; object-fit: fill; }
      .bill-visual { position: relative; height: 39mm; }
      .company-logo { position: absolute; top: 0; left: 50%; width: 37mm; height: 37mm; transform: translateX(-50%); object-fit: contain; }
      .document-box, .approval-box { position: absolute; top: 3mm; display: flex; width: 39mm; height: 27mm; flex-direction: column; align-items: center; justify-content: center; border: .5mm double #305477; padding: 2mm; color: #310909; text-align: center; }
      .document-box { left: 0; width: 46mm; }
      .approval-box { right: 0; }
      .document-box span, .approval-box span { font-size: 8pt; font-weight: 800; }
      .document-box b { margin-top: 2mm; font-family: Consolas, monospace; font-size: 8.5pt; white-space: nowrap; }
      .approval-box b { margin-top: 1mm; color: #9e372d; font-size: 11pt; }
      .approval-box small { margin-top: .5mm; color: #305477; font-size: 7pt; font-weight: 900; }
      .document-heading { margin-bottom: 2.5mm; text-align: center; }
      .document-heading h1 { margin: 0; color: #111; font-size: 17pt; font-weight: 900; line-height: 1.2; }
      .document-heading p { margin: 1mm 0 0; color: #305477; font-size: 9pt; font-weight: 800; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; }
      .meta-table { color: #310909; font-size: 8.5pt; }
      .meta-table th, .meta-table td { height: 8mm; border: .35mm solid #242424; padding: 1mm 1.5mm; text-align: right; vertical-align: middle; }
      .meta-table th { width: 20%; background: #f3f7fa; color: #310909; font-weight: 900; }
      .meta-table td { width: 30%; color: #111; font-weight: 700; overflow-wrap: anywhere; }
      .items-table { margin-top: 4mm; color: #111; font-size: 8.5pt; }
      .items-table th, .items-table td { height: 8mm; border: .35mm solid #242424; padding: 1mm 1.5mm; text-align: right; vertical-align: middle; }
      .items-table thead th { height: 10mm; background: #305477; color: #fff; font-weight: 900; text-align: center; }
      .items-table th:nth-child(1) { width: 7%; }
      .items-table th:nth-child(2) { width: 37%; }
      .items-table th:nth-child(3) { width: 17%; }
      .items-table th:nth-child(4), .items-table th:nth-child(5) { width: 19.5%; }
      .items-table .line-number { text-align: center; }
      .items-table td:nth-child(n+3) { text-align: center; }
      .items-table td small { display: block; margin-top: .8mm; color: #305477; font-family: Consolas, monospace; font-size: 7pt; overflow-wrap: anywhere; }
      .items-table .empty-row td { height: 7mm; }
      .bill-summary { display: grid; grid-template-columns: minmax(0, 1fr) 74mm; border: .35mm solid #242424; border-top: 0; color: #111; }
      .payment-reference { padding: 2.5mm; font-size: 8pt; line-height: 1.65; }
      .payment-reference p { margin: 0; }
      .bill-summary > table { border-right: .35mm solid #242424; }
      .bill-summary th, .bill-summary td { height: 7mm; border-bottom: .35mm solid #242424; padding: 1mm 2mm; font-size: 8.5pt; }
      .bill-summary tr:last-child th, .bill-summary tr:last-child td { border-bottom: 0; }
      .bill-summary th { text-align: right; }
      .bill-summary td { text-align: left; font-weight: 900; white-space: nowrap; }
      .bill-summary .remaining-row { background: #f4e7e5; color: #7f2d25; }
      .notes-box { display: grid; min-height: 15mm; grid-template-columns: 37mm 1fr; border: .35mm solid #242424; border-top: 0; color: #111; font-size: 8.5pt; }
      .notes-box b { display: flex; align-items: flex-start; border-left: .35mm solid #242424; padding: 2mm; color: #310909; }
      .notes-box span { padding: 2mm; line-height: 1.5; overflow-wrap: anywhere; }
      .signatures { display: grid; min-height: 24mm; grid-template-columns: repeat(3, 1fr); border: .35mm solid #242424; border-top: 0; color: #310909; font-size: 8pt; text-align: center; }
      .signatures > div { display: flex; flex-direction: column; justify-content: flex-end; border-left: .35mm solid #242424; padding: 2mm 2mm 3mm; }
      .signatures > div:first-child { border-left: 0; }
      .signatures span { font-weight: 800; }
      .signatures b { margin-top: 1mm; color: #305477; font-size: 7pt; }
      .bill-footer { display: flex; justify-content: space-between; gap: 5mm; border-top: .35mm solid #8fbce6; margin-top: 3mm; padding-top: 2mm; color: #305477; font-size: 7.5pt; font-weight: 800; }
      @media print {
        html, body { width: 215.9mm; min-width: 215.9mm; background: #fff !important; }
        .paktyamawj-bill-print-root, .paktyamawj-bill-print-root * { visibility: visible !important; }
        .print-toolbar { display: none !important; }
        .bill-document { display: block; padding: 0; }
        .bill-sheet { margin: 0; box-shadow: none; }
        .paktyamawj-bill-print-root, .bill-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `}</style>
  )
}
