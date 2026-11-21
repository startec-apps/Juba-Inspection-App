import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  FileText,
  CheckCircle2,
  Printer,
  Download,
  Pencil,
  Trash2,
  X,
  Building2,
  RefreshCw,
  Receipt
} from 'lucide-react';
import { InvoiceRecord, InvoiceLineItem, InvoiceStatus, SystemSettings, User } from '../../types';
import {
  getInvoicesFromFirebase,
  saveInvoiceToFirebase,
  deleteInvoiceFromFirebase
} from '../../services/firebase';

interface InvoicingSystemProps {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  handleSaveSettings: () => void;
  isSavingSettings: boolean;
  user?: User | null;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const CURRENCIES = ['USD', 'ZMW', 'EUR', 'GBP', 'KES', 'ZAR'];

const PAYMENT_TERMS_OPTIONS: { label: string; days: number }[] = [
  { label: 'Due on Receipt', days: 0 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 14', days: 14 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 60', days: 60 }
];

const SERVICE_PRESETS: Array<{ description: string; category: string; unitPrice: number }> = [
  { description: 'Heavy Truck & Trailer Safety Inspection', category: 'General Audit', unitPrice: 120 },
  { description: 'Petroleum Tanker Compliance Audit (V2)', category: 'Petroleum', unitPrice: 185 },
  { description: 'Acid Tanker Hazmat Integrity Inspection', category: 'Acid & Hazmat', unitPrice: 210 },
  { description: 'Monthly Fleet Portal License & Hosting', category: 'Subscription', unitPrice: 350 },
  { description: 'Corrective Maintenance Re-Inspection', category: 'Follow-Up', unitPrice: 75 }
];

const STATUS_BADGE_MAP: Record<InvoiceStatus, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200 line-through'
};

function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function formatMoney(amount: number, currency: string = 'USD'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch {
    return `${currency || 'USD'} ${safeAmount.toFixed(2)}`;
  }
}

function createEmptyLineItem(): InvoiceLineItem {
  return {
    id: `ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: '',
    category: 'Inspection Service',
    quantity: 1,
    unitPrice: 0,
    total: 0
  };
}

function generateNextInvoiceNumber(existing: InvoiceRecord[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  let maxSeq = 0;
  for (const inv of existing) {
    if (inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix)) {
      const tail = parseInt(inv.invoiceNumber.slice(prefix.length), 10);
      if (!isNaN(tail) && tail > maxSeq) maxSeq = tail;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export const InvoicingSystem: React.FC<InvoicingSystemProps> = ({
  settings,
  setSettings,
  handleSaveSettings,
  isSavingSettings,
  user,
  showToast
}) => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');
  const [showBillingProfile, setShowBillingProfile] = useState(false);

  // Create / Edit Drawer-Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  // Form Fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState('Net 14');
  const [dueDate, setDueDate] = useState(() => addDaysToIsoDate(new Date().toISOString().slice(0, 10), 14));
  const [currency, setCurrency] = useState(settings.defaultCurrency || 'USD');
  const [status, setStatus] = useState<InvoiceStatus>('Pending');
  const [items, setItems] = useState<InvoiceLineItem[]>([createEmptyLineItem()]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(settings.defaultTaxRate ?? 0);
  const [notes, setNotes] = useState(settings.paymentInstructions || '');

  // Preview / Print Modal State
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceRecord | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const previewPrintRef = useRef<HTMLDivElement>(null);

  const loadInvoices = async (forceRefresh: boolean = false) => {
    if (forceRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const records = await getInvoicesFromFirebase(forceRefresh);
      const todayStr = new Date().toISOString().slice(0, 10);
      const normalized = records.map(r => {
        if (r.status === 'Pending' && r.dueDate && r.dueDate < todayStr) {
          return { ...r, status: 'Overdue' as InvoiceStatus };
        }
        return r;
      });
      setInvoices(normalized);
    } catch {
      showToast('Could not load invoices.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInvoices(false);
  }, []);

  const primaryCurrency = useMemo(() => {
    return settings.defaultCurrency || invoices[0]?.currency || 'USD';
  }, [settings.defaultCurrency, invoices]);

  const metrics = useMemo(() => {
    let totalBilled = 0;
    let paidRevenue = 0;
    let outstanding = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    for (const inv of invoices) {
      if (inv.status === 'Cancelled') continue;
      if (inv.currency === primaryCurrency || !inv.currency) {
        totalBilled += Number(inv.total || 0);
      }
      if (inv.status === 'Paid') {
        paidCount++;
        if (inv.currency === primaryCurrency || !inv.currency) {
          paidRevenue += Number(inv.total || 0);
        }
      } else if (inv.status === 'Pending' || inv.status === 'Overdue') {
        if (inv.status === 'Overdue') overdueCount++;
        else pendingCount++;
        if (inv.currency === primaryCurrency || !inv.currency) {
          outstanding += Number(inv.total || 0);
        }
      }
    }

    return {
      totalBilled,
      paidRevenue,
      outstanding,
      totalCount: invoices.length,
      paidCount,
      pendingCount,
      overdueCount
    };
  }, [invoices, primaryCurrency]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter(inv => {
      if (statusFilter !== 'All' && inv.status !== statusFilter) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.clientEmail || '').toLowerCase().includes(q) ||
        inv.items.some(it => it.description.toLowerCase().includes(q))
      );
    });
  }, [invoices, searchQuery, statusFilter]);

  const computedTotals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
    const safeDiscount = Math.max(0, Math.min(subtotal, Number(discountAmount || 0)));
    const taxableBase = Math.max(0, subtotal - safeDiscount);
    const safeTaxRate = Math.max(0, Number(taxRate || 0));
    const taxAmount = +(taxableBase * (safeTaxRate / 100)).toFixed(2);
    const total = +(taxableBase + taxAmount).toFixed(2);
    return {
      subtotal: +subtotal.toFixed(2),
      discountAmount: +safeDiscount.toFixed(2),
      taxRate: safeTaxRate,
      taxAmount,
      total
    };
  }, [items, discountAmount, taxRate]);

  const openNewInvoiceModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEditingId(null);
    setInvoiceNumber(generateNextInvoiceNumber(invoices));
    setClientName('');
    setClientEmail('');
    setClientTaxId('');
    setClientAddress('');
    setIssueDate(today);
    setPaymentTerms('Net 14');
    setDueDate(addDaysToIsoDate(today, 14));
    setCurrency(settings.defaultCurrency || 'USD');
    setStatus('Pending');
    setItems([createEmptyLineItem()]);
    setDiscountAmount(0);
    setTaxRate(settings.defaultTaxRate ?? 0);
    setNotes(settings.paymentInstructions || '');
    setIsEditorOpen(true);
  };

  const openEditInvoiceModal = (inv: InvoiceRecord) => {
    setEditingId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setClientName(inv.clientName);
    setClientEmail(inv.clientEmail || '');
    setClientTaxId(inv.clientTaxId || '');
    setClientAddress(inv.clientAddress || '');
    setIssueDate(inv.issueDate);
    setPaymentTerms(inv.paymentTerms || 'Net 14');
    setDueDate(inv.dueDate);
    setCurrency(inv.currency || settings.defaultCurrency || 'USD');
    setStatus(inv.status);
    setItems(
      inv.items && inv.items.length > 0
        ? inv.items.map(it => ({ ...it }))
        : [createEmptyLineItem()]
    );
    setDiscountAmount(inv.discountAmount || 0);
    setTaxRate(inv.taxRate || 0);
    setNotes(inv.notes || '');
    setIsEditorOpen(true);
  };

  const handleTermsChange = (newTerms: string) => {
    setPaymentTerms(newTerms);
    const found = PAYMENT_TERMS_OPTIONS.find(t => t.label === newTerms);
    if (found) {
      setDueDate(addDaysToIsoDate(issueDate, found.days));
    }
  };

  const handleIssueDateChange = (newIssueDate: string) => {
    setIssueDate(newIssueDate);
    const found = PAYMENT_TERMS_OPTIONS.find(t => t.label === paymentTerms);
    if (found) {
      setDueDate(addDaysToIsoDate(newIssueDate, found.days));
    }
  };

  const handleUpdateItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const next: InvoiceLineItem = { ...it, [field]: value };
        const qty = Number(field === 'quantity' ? value : next.quantity) || 0;
        const price = Number(field === 'unitPrice' ? value : next.unitPrice) || 0;
        next.total = +(qty * price).toFixed(2);
        return next;
      })
    );
  };

  const handleAddPresetItem = (preset: { description: string; category: string; unitPrice: number }) => {
    setItems(prev => {
      const hasSingleBlank =
        prev.length === 1 && !prev[0].description.trim() && Number(prev[0].unitPrice) === 0;
      const newItem: InvoiceLineItem = {
        id: `ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: preset.description,
        category: preset.category,
        quantity: 1,
        unitPrice: preset.unitPrice,
        total: preset.unitPrice
      };
      return hasSingleBlank ? [newItem] : [...prev, newItem];
    });
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      showToast('Please enter a client or company name.', 'error');
      return;
    }
    const validItems = items
      .filter(it => it.description.trim().length > 0)
      .map(it => ({
        ...it,
        quantity: Math.max(0.01, Number(it.quantity) || 1),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        total: +((Math.max(0.01, Number(it.quantity) || 1)) * Math.max(0, Number(it.unitPrice) || 0)).toFixed(2)
      }));

    if (validItems.length === 0) {
      showToast('Add at least one billable line item.', 'error');
      return;
    }

    setIsSavingInvoice(true);
    try {
      const now = new Date().toISOString();
      const existingRecord = editingId ? invoices.find(i => i.id === editingId) : undefined;
      const record: InvoiceRecord = {
        id: editingId || `INV-${Date.now()}`,
        invoiceNumber: invoiceNumber.trim() || generateNextInvoiceNumber(invoices),
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientAddress: clientAddress.trim(),
        clientTaxId: clientTaxId.trim(),
        issueDate,
        dueDate,
        paymentTerms,
        currency,
        items: validItems,
        subtotal: computedTotals.subtotal,
        discountAmount: computedTotals.discountAmount,
        taxRate: computedTotals.taxRate,
        taxAmount: computedTotals.taxAmount,
        total: computedTotals.total,
        status,
        notes: notes.trim(),
        paidAt: status === 'Paid' ? (existingRecord?.paidAt || now) : existingRecord?.paidAt,
        createdBy: existingRecord?.createdBy || user?.name || user?.username || 'Admin',
        createdAt: existingRecord?.createdAt || now,
        updatedAt: now
      };

      const res = await saveInvoiceToFirebase(record);
      if (res.success) {
        setInvoices(prev => {
          const exists = prev.some(p => p.id === record.id);
          return exists ? prev.map(p => (p.id === record.id ? record : p)) : [record, ...prev];
        });
        showToast(`Invoice ${record.invoiceNumber} saved.`, 'success');
        setIsEditorOpen(false);
      } else {
        showToast('Unable to save invoice to cloud database.', 'error');
      }
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleMarkAsPaid = async (inv: InvoiceRecord) => {
    const now = new Date().toISOString();
    const updated: InvoiceRecord = {
      ...inv,
      status: 'Paid',
      paidAt: now,
      updatedAt: now
    };
    const res = await saveInvoiceToFirebase(updated);
    if (res.success) {
      setInvoices(prev => prev.map(p => (p.id === inv.id ? updated : p)));
      if (previewInvoice?.id === inv.id) setPreviewInvoice(updated);
      showToast(`Invoice ${inv.invoiceNumber} marked as Paid.`, 'success');
    } else {
      showToast('Failed to update invoice status.', 'error');
    }
  };

  const handleDeleteInvoice = async (invId: string) => {
    const target = invoices.find(i => i.id === invId);
    const ok = await deleteInvoiceFromFirebase(invId);
    if (ok) {
      setInvoices(prev => prev.filter(i => i.id !== invId));
      if (previewInvoice?.id === invId) setPreviewInvoice(null);
      setConfirmDeleteId(null);
      showToast(`Invoice ${target?.invoiceNumber || ''} deleted.`, 'info');
    } else {
      showToast('Failed to delete invoice.', 'error');
    }
  };

  const handlePrintInvoice = (inv: InvoiceRecord) => {
    if (!previewPrintRef.current) return;
    const html = previewPrintRef.current.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '100vw';
    iframe.style.bottom = '100vh';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${inv.invoiceNumber} - ${inv.clientName}</title>
        <meta charset="UTF-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 14mm; }
          body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .tabular-nums { font-variant-numeric: tabular-nums; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `);
    iframeDoc.close();

    const checkReady = setInterval(() => {
      if (iframeDoc.readyState === 'complete') {
        clearInterval(checkReady);
        const imgs = Array.from(iframeDoc.getElementsByTagName('img'));
        Promise.all(
          imgs.map(img => (img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })))
        ).then(() => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (iframe.parentNode) document.body.removeChild(iframe);
            }, 2000);
          }, 400);
        });
      }
    }, 100);
  };

  const handleDownloadInvoicePdf = async (inv: InvoiceRecord) => {
    if (!previewPrintRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = (html2pdfModule.default || html2pdfModule) as any;
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `${inv.invoiceNumber}_${inv.clientName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(previewPrintRef.current)
        .save();
      showToast(`Downloaded ${inv.invoiceNumber}.pdf`, 'success');
    } catch {
      showToast('Direct PDF download unavailable; opening system print.', 'info');
      handlePrintInvoice(inv);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const validLogo =
    typeof settings.companyLogo === 'string' &&
    settings.companyLogo.trim().length > 10 &&
    !settings.companyLogo.includes('Firebase') &&
    (settings.companyLogo.startsWith('data:image/') ||
      settings.companyLogo.startsWith('http://') ||
      settings.companyLogo.startsWith('https://') ||
      settings.companyLogo.startsWith('/'))
      ? settings.companyLogo
      : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Billed</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
            {formatMoney(metrics.totalBilled, primaryCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Across active invoices</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Collected (Paid)</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums tracking-tight">
            {formatMoney(metrics.paidRevenue, primaryCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">{metrics.paidCount} settled invoice{metrics.paidCount === 1 ? '' : 's'}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Outstanding</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-amber-700 tabular-nums tracking-tight">
            {formatMoney(metrics.outstanding, primaryCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {metrics.pendingCount} pending{metrics.overdueCount > 0 ? ` • ${metrics.overdueCount} overdue` : ''}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Invoices</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
            {metrics.totalCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Default currency: {primaryCurrency}</p>
        </div>
      </div>

      {/* Billing Profile Configuration Drawer */}
      <AnimatePresence>
        {showBillingProfile && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Organization Billing Profile</h3>
                  <p className="text-xs text-slate-500">Defaults printed on issued invoices</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBillingProfile(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={settings.billingEmail || ''}
                  onChange={e => setSettings(s => ({ ...s, billingEmail: e.target.value }))}
                  placeholder="accounts@company.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Tax / VAT Registration No.
                </label>
                <input
                  type="text"
                  value={settings.taxId || ''}
                  onChange={e => setSettings(s => ({ ...s, taxId: e.target.value }))}
                  placeholder="e.g. TPIN-100482910"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <select
                    value={settings.defaultCurrency || 'USD'}
                    onChange={e => setSettings(s => ({ ...s, defaultCurrency: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Default Tax %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.defaultTaxRate ?? 0}
                    onChange={e => setSettings(s => ({ ...s, defaultTaxRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-500 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Company Billing Address
                </label>
                <textarea
                  rows={2}
                  value={settings.billingAddress || ''}
                  onChange={e => setSettings(s => ({ ...s, billingAddress: e.target.value }))}
                  placeholder="Plot 42 Industrial Road, Lusaka, Zambia"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Default Bank / Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={settings.paymentInstructions || ''}
                  onChange={e => setSettings(s => ({ ...s, paymentInstructions: e.target.value }))}
                  placeholder="Bank name, Account No., Swift/Branch code, or Mobile Money details"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {isSavingSettings ? 'Saving Profile...' : 'Save Billing Profile'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Invoicing Ledger Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['All', 'Pending', 'Paid', 'Overdue', 'Draft'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search invoice # or client..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowBillingProfile(v => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                showBillingProfile
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Billing Profile</span>
            </button>

            <button
              type="button"
              onClick={() => loadInvoices(true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
              title="Refresh invoices"
              aria-label="Refresh invoices"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={openNewInvoiceModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shadow-xs active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Invoice</span>
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-7 h-7 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-500">Loading billing ledger...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {invoices.length === 0 ? 'No invoices issued yet' : 'No matching invoices'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {invoices.length === 0
                  ? 'Create itemized client invoices for fleet safety audits, hazmat certifications, or portal billing.'
                  : 'Try adjusting your status filter or search query.'}
              </p>
            </div>
            {invoices.length === 0 && (
              <button
                type="button"
                onClick={openNewInvoiceModal}
                className="mt-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Invoice
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Issued</th>
                    <th className="py-3 px-4">Due</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{inv.clientName}</div>
                        {inv.clientEmail && (
                          <div className="text-xs text-slate-400">{inv.clientEmail}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs tabular-nums whitespace-nowrap">
                        {inv.issueDate}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs tabular-nums whitespace-nowrap">
                        {inv.dueDate}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatMoney(inv.total, inv.currency)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_BADGE_MAP[inv.status]}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewInvoice(inv)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Preview & Print Invoice"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(inv)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Mark as Paid"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditInvoiceModal(inv)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Edit Invoice"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === inv.id ? (
                            <div className="inline-flex items-center gap-1 ml-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-0.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="text-[11px] font-bold text-rose-700 hover:underline"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 ml-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(inv.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredInvoices.map(inv => (
                <div key={inv.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 tabular-nums">{inv.invoiceNumber}</span>
                      <h4 className="text-sm font-bold text-slate-900">{inv.clientName}</h4>
                      <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                        Issued {inv.issueDate} • Due {inv.dueDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${STATUS_BADGE_MAP[inv.status]}`}>
                        {inv.status}
                      </span>
                      <p className="text-base font-bold text-slate-900 tabular-nums mt-1">
                        {formatMoney(inv.total, inv.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View / PDF
                      </button>
                      {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsPaid(inv)}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Paid
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditInvoiceModal(inv)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        aria-label="Edit invoice"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {confirmDeleteId === inv.id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold"
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(inv.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                          aria-label="Delete invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Invoice Modal */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          >
            <div
              onClick={() => !isSavingInvoice && setIsEditorOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
            />
            <motion.form
              onSubmit={handleSaveInvoice}
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingId ? `Edit Invoice ${invoiceNumber}` : 'Create New Invoice'}
                  </h3>
                  <p className="text-xs text-slate-500">Itemized billing record for {settings.companyName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* Metadata & Client Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Client Details</h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Client / Company Name *</label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="e.g. Copperbelt Logistics Ltd"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Client Email</label>
                        <input
                          type="email"
                          value={clientEmail}
                          onChange={e => setClientEmail(e.target.value)}
                          placeholder="billing@client.com"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Client Tax / VAT ID</label>
                        <input
                          type="text"
                          value={clientTaxId}
                          onChange={e => setClientTaxId(e.target.value)}
                          placeholder="Optional"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Client Billing Address</label>
                      <input
                        type="text"
                        value={clientAddress}
                        onChange={e => setClientAddress(e.target.value)}
                        placeholder="Street address, city, country"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice Terms & Status</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number *</label>
                        <input
                          type="text"
                          required
                          value={invoiceNumber}
                          onChange={e => setInvoiceNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 tabular-nums outline-none focus:bg-white focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                        <select
                          value={status}
                          onChange={e => setStatus(e.target.value as InvoiceStatus)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Pending">Pending</option>
                          <option value="Paid">Paid</option>
                          <option value="Overdue">Overdue</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Date</label>
                        <input
                          type="date"
                          required
                          value={issueDate}
                          onChange={e => handleIssueDateChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 tabular-nums outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                        <input
                          type="date"
                          required
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 tabular-nums outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
                        <select
                          value={paymentTerms}
                          onChange={e => handleTermsChange(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-500"
                        >
                          {PAYMENT_TERMS_OPTIONS.map(opt => (
                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                        <select
                          value={currency}
                          onChange={e => setCurrency(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Service Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Fleet Service Presets</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICE_PRESETS.map(preset => (
                      <button
                        key={preset.description}
                        type="button"
                        onClick={() => handleAddPresetItem(preset)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-medium text-slate-700 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{preset.description}</span>
                        <span className="text-slate-400 tabular-nums">({formatMoney(preset.unitPrice, currency)})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Line Items</h4>
                    <button
                      type="button"
                      onClick={() => setItems(prev => [...prev, createEmptyLineItem()])}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Row
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="hidden sm:grid sm:grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <div className="col-span-6">Description</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit Price</div>
                      <div className="col-span-2 text-right">Line Total</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <div key={item.id} className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-6 flex items-center gap-2">
                            <input
                              type="text"
                              required={idx === 0}
                              value={item.description}
                              onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                              placeholder="Service or inspection description"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="grid grid-cols-3 sm:contents gap-2">
                            <div className="sm:col-span-2">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right text-slate-900 tabular-nums outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={e => handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right text-slate-900 tabular-nums outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                                {formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0), currency)}
                              </span>
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes & Summary Calculation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Payment Instructions</label>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Remittance bank account, wire details, or reference terms..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatMoney(computedTotals.subtotal, currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-slate-600">
                      <span>Discount ({currency})</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountAmount}
                        onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        className="w-28 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-right text-sm text-slate-900 tabular-nums outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 text-slate-600">
                      <span>Tax / VAT Rate (%)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={taxRate}
                          onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-right text-sm text-slate-900 tabular-nums outline-none focus:border-indigo-500"
                        />
                        <span className="w-24 text-right font-medium text-slate-700 tabular-nums">
                          {formatMoney(computedTotals.taxAmount, currency)}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-900">Total Due</span>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">
                        {formatMoney(computedTotals.total, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingInvoice}
                  className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {isSavingInvoice ? 'Saving...' : editingId ? 'Update Invoice' : 'Issue Invoice'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice Preview / Print / Download Modal */}
      <AnimatePresence>
        {previewInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-6"
          >
            <div
              onClick={() => setPreviewInvoice(null)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]"
            >
              {/* Action Bar */}
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{previewInvoice.invoiceNumber}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_BADGE_MAP[previewInvoice.status]}`}>
                    {previewInvoice.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {previewInvoice.status !== 'Paid' && previewInvoice.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsPaid(previewInvoice)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Paid
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePrintInvoice(previewInvoice)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadInvoicePdf(previewInvoice)}
                    disabled={isExportingPdf}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isExportingPdf ? 'Generating...' : 'Download PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewInvoice(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg ml-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable A4 Canvas */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100">
                <div
                  ref={previewPrintRef}
                  className="bg-white max-w-[780px] mx-auto p-6 sm:p-10 rounded-xl border border-slate-200 shadow-2xs text-slate-900 space-y-8"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6">
                    <div className="space-y-2">
                      {validLogo && (
                        <div className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg inline-flex items-center">
                          <img src={validLogo} alt="Company Logo" className="h-10 w-auto object-contain" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{settings.companyName || 'Fleet Portal'}</h2>
                        {settings.billingAddress && (
                          <p className="text-xs text-slate-500 whitespace-pre-line mt-0.5">{settings.billingAddress}</p>
                        )}
                        {(settings.billingEmail || settings.managerEmail) && (
                          <p className="text-xs text-slate-500 mt-0.5">{settings.billingEmail || settings.managerEmail}</p>
                        )}
                        {settings.taxId && (
                          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">Tax ID: {settings.taxId}</p>
                        )}
                      </div>
                    </div>

                    <div className="sm:text-right space-y-1">
                      <p className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase">Invoice</p>
                      <p className="text-sm font-bold text-indigo-600 tabular-nums">{previewInvoice.invoiceNumber}</p>
                      <div className="pt-2 space-y-1 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-400">Issue Date: </span>
                          <span className="font-semibold text-slate-800 tabular-nums">{previewInvoice.issueDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Due Date: </span>
                          <span className="font-semibold text-slate-800 tabular-nums">{previewInvoice.dueDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Terms: </span>
                          <span className="font-semibold text-slate-800">{previewInvoice.paymentTerms}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Status: </span>
                          <span className="font-bold text-slate-900 uppercase">{previewInvoice.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bill To */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bill To</p>
                      <p className="text-sm font-bold text-slate-900">{previewInvoice.clientName}</p>
                      {previewInvoice.clientAddress && (
                        <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">{previewInvoice.clientAddress}</p>
                      )}
                      {previewInvoice.clientEmail && (
                        <p className="text-xs text-slate-600 mt-0.5">{previewInvoice.clientEmail}</p>
                      )}
                      {previewInvoice.clientTaxId && (
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">Tax ID: {previewInvoice.clientTaxId}</p>
                      )}
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Amount Due</p>
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {formatMoney(previewInvoice.total, previewInvoice.currency)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Currency: {previewInvoice.currency}</p>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-2.5 px-4">Description</th>
                          <th className="py-2.5 px-4 text-right">Qty</th>
                          <th className="py-2.5 px-4 text-right">Unit Price</th>
                          <th className="py-2.5 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {previewInvoice.items.map(item => (
                          <tr key={item.id}>
                            <td className="py-3 px-4 font-medium text-slate-800">{item.description}</td>
                            <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{item.quantity}</td>
                            <td className="py-3 px-4 text-right text-slate-600 tabular-nums">
                              {formatMoney(item.unitPrice, previewInvoice.currency)}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                              {formatMoney(item.total, previewInvoice.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals & Notes */}
                  <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
                    <div className="flex-1">
                      {(previewInvoice.notes || settings.paymentInstructions) && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Payment Instructions & Notes
                          </p>
                          <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                            {previewInvoice.notes || settings.paymentInstructions}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-64 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {formatMoney(previewInvoice.subtotal, previewInvoice.currency)}
                        </span>
                      </div>
                      {previewInvoice.discountAmount > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Discount</span>
                          <span className="font-semibold text-rose-600 tabular-nums">
                            -{formatMoney(previewInvoice.discountAmount, previewInvoice.currency)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>Tax ({previewInvoice.taxRate}%)</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {formatMoney(previewInvoice.taxAmount, previewInvoice.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {formatMoney(previewInvoice.total, previewInvoice.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Prepared by {previewInvoice.createdBy}</span>
                    <span>{settings.companyName || 'SafetyCheck Pro'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoicingSystem;
