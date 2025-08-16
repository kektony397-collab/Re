
import type { Receipt, Settings } from './types';
import { SOCIETY_INFO } from './constants';

// These would be imported from npm packages in a real build environment
declare const jspdf: any;
declare const html2canvas: any;
declare const XLSX: any;

export const generateReceiptPdf = (receipt: Receipt, settings: Settings | null, t: (key: string) => string): void => {
  const receiptElement = document.getElementById('receipt-template');
  if (receiptElement && (window as any).html2canvas && (window as any).jspdf) {
    const { jsPDF } = (window as any).jspdf;
    (window as any).html2canvas(receiptElement, { scale: 2 }).then((canvas: HTMLCanvasElement) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt-${receipt.receiptNumber}.pdf`);
    });
  } else {
    alert("PDF generation library is not loaded.");
  }
};


export const exportReceiptsToPdf = (receipts: Receipt[], t: (key: string) => string): void => {
  if (!(window as any).jspdf || !(window as any).jspdf.plugin.autotable) {
    alert("PDF generation library is not loaded.");
    return;
  }
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF();

  const grandTotal = receipts.reduce((sum, r) => sum + r.amount, 0);

  (doc as any).autoTable({
    head: [[t('receiptNo'), t('residentName'), t('date'), t('amount')]],
    body: receipts.map(r => [r.receiptNumber, r.name, r.date, r.amount.toFixed(2)]),
    foot: [['Total', '', '', grandTotal.toFixed(2)]],
    didDrawPage: (data: any) => {
      doc.setFontSize(20);
      doc.text(t('receipts'), data.settings.margin.left, 15);
    },
  });

  doc.save('All_Receipts.pdf');
};


export const exportReceiptsToExcel = (receipts: Receipt[], t: (key: string) => string): void => {
  if (!(window as any).XLSX) {
      alert("Excel generation library is not loaded.");
      return;
  }
  
  const grandTotal = receipts.reduce((sum, r) => sum + r.amount, 0);
  
  const worksheetData = receipts.map(r => ({
    [t('receiptNo')]: r.receiptNumber,
    [t('residentName')]: r.name,
    [t('blockNo')]: r.blockNumber,
    [t('date')]: r.date,
    [t('forMonth')]: r.forMonth,
    [t('paymentMethod')]: r.paymentMethod,
    [t('amount')]: r.amount,
  }));

  worksheetData.push({
    [t('receiptNo')]: t('totalAmount'),
    [t('residentName')]: '',
    [t('blockNo')]: '',
    [t('date')]: '',
    [t('forMonth')]: '',
    [t('paymentMethod')]: '',
    [t('amount')]: grandTotal,
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('receipts'));

  XLSX.writeFile(workbook, 'All_Receipts.xlsx');
};

export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
}