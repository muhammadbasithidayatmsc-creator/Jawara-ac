import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BusinessSettings, Invoice, Order, OrderItem, Payment } from '../types/database';
import { downloadXlsxWorkbook, type ExcelSheetData } from './xlsxExport';

export function formatRupiah(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

export function formatNumberID(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return '0';
  return new Intl.NumberFormat('id-ID').format(num);
}

export function formatDateID(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeID(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

export function normalizeWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizeWhatsApp(phone);
  if (!normalized) return '#';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildOrderWhatsAppMessage(
  order: Pick<
    Order,
    | 'order_number'
    | 'invoice_number'
    | 'customer_name'
    | 'service_name'
    | 'service_date'
    | 'service_time'
    | 'technician_name'
    | 'total_amount'
    | 'paid_amount'
    | 'payment_status'
  >,
  settings?: BusinessSettings | null
): string {
  const brand = settings?.business_name || 'JAWARA AC';
  const remaining = Math.max(0, Number(order.total_amount) - Number(order.paid_amount));
  const schedule = order.service_time
    ? `${formatDateID(order.service_date)} pukul ${order.service_time.slice(0, 5)} WIB`
    : formatDateID(order.service_date);

  const lines = [
    `Halo Kak *${order.customer_name}*,`,
    `Berikut informasi layanan dari *${brand}*:`,
    '',
    `• No. Order: ${order.order_number}`,
    ...(order.invoice_number ? [`• No. Invoice: ${order.invoice_number}`] : []),
    `• Layanan: ${order.service_name}`,
    `• Jadwal Service: ${schedule}`,
    `• Teknisi: ${order.technician_name || 'Segera dijadwalkan'}`,
    `• Total Tagihan: ${formatRupiah(order.total_amount)}`,
    `• Sudah Dibayar: ${formatRupiah(order.paid_amount)} (${order.payment_status})`,
    ...(remaining > 0 ? [`• Sisa Tagihan: ${formatRupiah(remaining)}`] : []),
  ];

  if (remaining > 0 && settings?.bank_name && settings?.bank_account_number) {
    lines.push(
      '',
      `Pembayaran transfer dapat dikirim ke:`,
      `${settings.bank_name} - ${settings.bank_account_number} (a.n. ${settings.bank_account_name || brand})`
    );
  }

  lines.push('', `Terima kasih telah mempercayakan perawatan AC Anda kepada *${brand}*.`);
  return lines.join('\n');
}

export function buildInvoiceWhatsAppMessage(
  invoice: Invoice,
  settings?: BusinessSettings | null
): string {
  const brand = settings?.business_name || 'JAWARA AC';
  const lines = [
    `Halo Kak *${invoice.customer_name}*,`,
    `Berikut rincian Invoice layanan *${brand}*:`,
    '',
    `• No. Invoice: ${invoice.invoice_number}`,
    `• Tanggal: ${formatDateID(invoice.issued_date)}`,
    `• Layanan: ${invoice.service_name}`,
    `• Teknisi: ${invoice.technician_name || '-'}`,
    `• Total Tagihan: ${formatRupiah(invoice.total_amount)}`,
    `• Total Dibayar: ${formatRupiah(invoice.paid_amount)}`,
    `• Sisa Tagihan: ${formatRupiah(invoice.remaining_amount)}`,
    `• Status Pembayaran: *${invoice.payment_status}*`,
  ];

  if (invoice.remaining_amount > 0 && settings?.bank_name && settings?.bank_account_number) {
    lines.push(
      '',
      `Rekening Pembayaran:`,
      `${settings.bank_name} ${settings.bank_account_number} a.n. ${settings.bank_account_name || brand}`
    );
  }

  lines.push('', `Terima kasih — *${brand}*`);
  return lines.join('\n');
}

export type { ExcelSheetData };

export function exportToExcel(filename: string, sheets: ExcelSheetData[]): void {
  downloadXlsxWorkbook(filename, sheets);
}

export function exportTableToPDF(options: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  summaryPairs?: { label: string; value: string }[];
  filename: string;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(11, 31, 58);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('JAWARA AC', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Service AC Lebih Mudah, Bisnis Lebih Maju', 14, 18);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, 14, 36);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(options.subtitle, 14, 42);

  let startY = 48;

  if (options.summaryPairs && options.summaryPairs.length > 0) {
    doc.setFontSize(9);
    options.summaryPairs.forEach((pair, idx) => {
      const y = startY + idx * 5.5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${pair.label}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(pair.value, 68, y);
    });
    startY += options.summaryPairs.length * 5.5 + 4;
  }

  autoTable(doc, {
    startY,
    head: [options.headers],
    body: options.rows,
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [11, 31, 58], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save(options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`);
}

export function exportInvoiceToPDF(options: {
  invoice: Invoice;
  orderNumber: string;
  items: OrderItem[];
  payments: Payment[];
  settings?: BusinessSettings | null;
}): void {
  const { invoice, orderNumber, items, payments, settings } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const brand = settings?.business_name || 'JAWARA AC';

  // Navy Top Header
  doc.setFillColor(11, 31, 58);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(brand, 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(settings?.tagline || 'Service AC Lebih Mudah, Bisnis Lebih Maju', 14, 20);
  if (settings?.address || settings?.whatsapp) {
    doc.setFontSize(8);
    doc.text(
      [settings.address, settings.whatsapp ? `WA: ${settings.whatsapp}` : ''].filter(Boolean).join(' | '),
      14,
      26
    );
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 196, 15, { align: 'right' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, 196, 22, { align: 'right' });

  // Info columns
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TAGIHAN KEPADA:', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customer_name, 14, 47);
  if (invoice.customer_whatsapp) doc.text(`WA: ${invoice.customer_whatsapp}`, 14, 52);
  const addrLines = doc.splitTextToSize(invoice.customer_address || '-', 95);
  doc.text(addrLines, 14, 57);

  doc.setFont('helvetica', 'bold');
  doc.text('DETAIL ORDER:', 125, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`No. Order: ${orderNumber}`, 125, 47);
  doc.text(`Tanggal: ${formatDateID(invoice.issued_date)}`, 125, 52);
  doc.text(`Pelayanan: ${invoice.service_name}`, 125, 57);
  doc.text(`Teknisi: ${invoice.technician_name || '-'}`, 125, 62);
  doc.setFont('helvetica', 'bold');
  doc.text(`Status: ${invoice.payment_status}`, 125, 67);

  const tableStartY = Math.max(74, 57 + addrLines.length * 4.5 + 6);

  const tableRows =
    items.length > 0
      ? items.map((item, idx) => [
          String(idx + 1),
          item.description ? `${item.work_name}\n${item.description}` : item.work_name,
          `${formatNumberID(item.quantity)} ${item.unit}`,
          formatRupiah(item.unit_price),
          formatRupiah(item.subtotal),
        ])
      : [
          [
            '1',
            invoice.service_name,
            '1 Layanan',
            formatRupiah(invoice.subtotal_amount),
            formatRupiah(invoice.subtotal_amount),
          ],
        ];

  autoTable(doc, {
    startY: tableStartY,
    head: [['No', 'Rincian Pekerjaan', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: tableRows,
    styles: { fontSize: 9, cellPadding: 3, textColor: [15, 23, 42] },
    headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 34, halign: 'right' },
      4: { cellWidth: 34, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120) + 8;

  const summaryRows: [string, string][] = [
    ['Subtotal Pekerjaan', formatRupiah(invoice.subtotal_amount)],
  ];
  if (Number(invoice.additional_cost) > 0) {
    summaryRows.push(['Biaya Tambahan', formatRupiah(invoice.additional_cost)]);
  }
  if (Number(invoice.material_cost) > 0) {
    summaryRows.push(['Biaya Material', formatRupiah(invoice.material_cost)]);
  }
  if (Number(invoice.discount) > 0) {
    summaryRows.push(['Diskon', `- ${formatRupiah(invoice.discount)}`]);
  }
  summaryRows.push(['Total Tagihan', formatRupiah(invoice.total_amount)]);
  summaryRows.push(['Total Pembayaran', formatRupiah(invoice.paid_amount)]);
  summaryRows.push(['Sisa Tagihan', formatRupiah(invoice.remaining_amount)]);

  let yCursor = finalY;
  summaryRows.forEach(([label, val], idx) => {
    const isHighlight = idx >= summaryRows.length - 3;
    doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
    doc.setFontSize(isHighlight ? 10 : 9);
    doc.text(label, 125, yCursor);
    doc.text(val, 196, yCursor, { align: 'right' });
    yCursor += 5.5;
  });

  const activePayments = payments.filter((p) => !p.is_void);
  if (activePayments.length > 0) {
    yCursor += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Riwayat Pembayaran:', 14, yCursor);
    yCursor += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    activePayments.forEach((p) => {
      doc.text(
        `• ${formatDateID(p.payment_date)} — ${p.payment_method} — ${formatRupiah(p.amount)}${p.notes ? ` (${p.notes})` : ''}`,
        14,
        yCursor
      );
      yCursor += 4.5;
    });
  }

  if (settings?.bank_name && settings?.bank_account_number) {
    yCursor += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Info Transfer Bank:', 14, yCursor);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${settings.bank_name} — No. Rek: ${settings.bank_account_number} (a.n. ${settings.bank_account_name || brand})`,
      14,
      yCursor + 5
    );
    yCursor += 10;
  }

  if (settings?.invoice_footer_note) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const footerLines = doc.splitTextToSize(settings.invoice_footer_note, 180);
    doc.text(footerLines, 14, Math.min(280, yCursor + 6));
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
