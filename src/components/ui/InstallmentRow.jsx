import { formatDate, formatCurrency, getInstallmentStatusLabel, getInstallmentStatusClass, getPaymentMethodLabel } from '@/lib/utils'
import { CreditCard, Calendar, CheckCircle2, DollarSign, MessageCircle, MoreVertical } from 'lucide-react'
import { useState } from 'react'
import PaymentModal from './PaymentModal'

export default function InstallmentRow({ installment, showParty = true, currencySymbol = 'ج.م', onWhatsApp }) {
  const [showPayment, setShowPayment] = useState(false)

  const status = installment.status
  const isPaid = status === 'paid'
  const partyName = installment.contracts?.clients?.name || installment.contracts?.suppliers?.name

  return (
    <>
      <tr className={isPaid ? 'opacity-60' : ''}>
        <td>
          <div className="flex flex-col">
            <span className="font-semibold text-heading">
              قسط #{installment.installment_number}
            </span>
            {showParty && partyName && (
              <span className="text-xs text-muted">{partyName}</span>
            )}
          </div>
        </td>
        <td>
          <span className="text-sm">{formatDate(installment.due_date)}</span>
        </td>
        <td>
          <div className="flex flex-col">
            <span className="font-semibold">{formatCurrency(installment.amount, currencySymbol)}</span>
            {status === 'partial' && (
              <span className="text-xs text-warning-600 dark:text-warning-400">
                متبقي: {formatCurrency(installment.remaining_amount, currencySymbol)}
              </span>
            )}
          </div>
        </td>
        <td>
          <span className={getInstallmentStatusClass(status)}>
            {getInstallmentStatusLabel(status)}
          </span>
        </td>
        <td>
          {isPaid ? (
            <div className="flex flex-col">
              <span className="text-xs text-success-600">{formatDate(installment.payment_date)}</span>
              <span className="text-xs text-muted">{getPaymentMethodLabel(installment.payment_method)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPayment(true)}
                className="btn-success btn-sm"
              >
                <DollarSign size={13} />
                تسجيل دفعة
              </button>
              {onWhatsApp && (
                <button
                  onClick={() => onWhatsApp(installment)}
                  className="btn-ghost btn-icon btn-sm text-green-600"
                  title="إرسال تذكير واتساب"
                >
                  <MessageCircle size={16} />
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      <PaymentModal
        installment={installment}
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        currencySymbol={currencySymbol}
      />
    </>
  )
}
