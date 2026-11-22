import React from 'react';
import { CreditCard, Clock, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SubscriptionSummary } from '../../services/firebase';

interface BillingStatusNoticeProps {
  subscription: SubscriptionSummary;
  invoicesLoaded: boolean;
  userRole?: string;
  activeModule: string;
  onOpenInvoicing?: () => void;
}

function formatMoney(amount: number, currency: string = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safe);
  } catch {
    return `${currency || 'USD'} ${safe.toFixed(2)}`;
  }
}

export const BillingStatusNotice: React.FC<BillingStatusNoticeProps> = ({
  subscription,
  invoicesLoaded,
  userRole,
  activeModule,
  onOpenInvoicing
}) => {
  if (!invoicesLoaded) return null;

  const cleanRole = String(userRole || '').trim().toLowerCase();
  const isSuperAdmin = cleanRole === 'superadmin' || cleanRole === 'super admin';
  const isAdmin = isSuperAdmin || cleanRole === 'admin';

  // Keep Settings workspace uncluttered while already managing invoicing/settings
  if (activeModule === 'settings' && isAdmin) return null;

  // Show renewal reminder banner for Admins/SuperAdmins when active rental expires within 5 days
  if (subscription.isActive) {
    if (subscription.state !== 'expiring_soon' || !isAdmin) return null;
    const inv = subscription.activeInvoice;
    const daysText =
      subscription.daysRemaining === 0
        ? 'Expires today'
        : `${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? '' : 's'} remaining`;

    return (
      <div
        role="status"
        className="w-full max-w-6xl mx-auto mb-3 bg-amber-50/90 border border-amber-200 rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
              Rental License Renewal Approaching
            </p>
            <p className="text-[11px] text-slate-600 leading-snug mt-0.5 tabular-nums">
              {inv?.invoiceNumber || 'Active License'} · Valid until {subscription.validUntil} · {daysText}
            </p>
          </div>
        </div>
        {onOpenInvoicing && (
          <button
            type="button"
            onClick={onOpenInvoicing}
            className="w-full sm:w-auto px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Issue Renewal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  const isExpired = subscription.state === 'expired';
  const outstanding = subscription.outstandingInvoice;
  const expiredInv = subscription.latestExpiredInvoice;
  const isOverdue = Boolean(
    outstanding &&
      (outstanding.status === 'Overdue' ||
        (outstanding.dueDate && outstanding.dueDate < new Date().toISOString().slice(0, 10)))
  );

  const urgentTone = isExpired || isOverdue;

  const title = !isAdmin
    ? 'Account Payment Due — New Inspections Paused'
    : isExpired
      ? 'Rental Subscription Expired — New Inspections Paused'
      : outstanding
        ? isOverdue
          ? 'Account Payment Overdue — New Inspections Paused'
          : 'Account Payment Due — New Inspections Paused'
        : 'Payment Due — Active Rental Invoice Required';

  const message = isSuperAdmin
    ? outstanding
      ? 'Review the client invoice in Invoicing and mark it Paid once settlement is confirmed to restore inspection creation.'
      : isExpired
        ? 'Issue a renewal invoice with a new rental validity period and mark it Paid in Invoicing to restore inspection creation.'
        : 'Create a client invoice with a rental validity period and mark it Paid in Invoicing to activate inspection creation.'
    : isAdmin
      ? outstanding
        ? 'Invoice settlement is pending. Once payment is received, a SuperAdmin must mark the invoice Paid to restore inspection creation.'
        : 'Create a client invoice with a rental validity period under Invoicing. SuperAdmin payment confirmation restores system access.'
      : 'New inspection creation is temporarily paused. Existing inspection records remain viewable.';

  const metaParts: string[] = [];
  if (isAdmin) {
    if (outstanding) {
      metaParts.push(outstanding.invoiceNumber);
      metaParts.push(formatMoney(outstanding.total, outstanding.currency));
      metaParts.push(`Due ${outstanding.dueDate}`);
      if (outstanding.validFrom && outstanding.validUntil) {
        metaParts.push(`Term ${outstanding.validFrom} – ${outstanding.validUntil}`);
      }
    } else if (expiredInv) {
      metaParts.push(expiredInv.invoiceNumber);
      metaParts.push(`Term ended ${expiredInv.validUntil}`);
    }
  }

  return (
    <div
      role="alert"
      className={`w-full max-w-6xl mx-auto mb-3 sm:mb-4 rounded-2xl border px-3.5 py-3 sm:px-5 sm:py-3.5 shadow-2xs transition-colors ${
        isAdmin && urgentTone
          ? 'bg-rose-50/90 border-rose-200'
          : 'bg-amber-50/90 border-amber-200'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-5">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border flex items-center justify-center shrink-0 mt-0.5 ${
              isAdmin && urgentTone
                ? 'border-rose-200 text-rose-600'
                : 'border-amber-200 text-amber-600'
            }`}
          >
            {isAdmin && isExpired ? (
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : isAdmin && outstanding ? (
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
              {title}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed">
              {message}
            </p>
            {isAdmin && metaParts.length > 0 && (
              <p className="text-[11px] font-semibold text-slate-600 tabular-nums pt-0.5">
                {metaParts.join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center sm:justify-end shrink-0 pl-12 md:pl-0">
          {isAdmin && onOpenInvoicing ? (
            <button
              type="button"
              onClick={onOpenInvoicing}
              className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              {isSuperAdmin && outstanding ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <CreditCard className="w-3.5 h-3.5" />
              )}
              <span>
                {isSuperAdmin
                  ? outstanding
                    ? 'Review & Mark Paid'
                    : 'Open Invoicing'
                  : 'Open Invoicing'}
              </span>
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
              Contact Administrator
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingStatusNotice;
