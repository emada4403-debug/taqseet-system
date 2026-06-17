import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSupplier, useSettings } from '@/hooks/useApi'
import {
  formatCurrency, formatDate, calculateContractBalance,
  getContractStatusClass, getContractStatusLabel,
  getInstallmentStatusClass, getInstallmentStatusLabel
} from '@/lib/utils'
import { PageLoader, ErrorState } from '@/components/ui/States'
import PaymentModal from '@/components/ui/PaymentModal'
import { ArrowRight, Phone, Building2, Store, ChevronDown, ChevronUp, Plus, FileText } from 'lucide-react'

function SupplierContractCard({ contract, symbol, onPay }) {
  const [expanded, setExpanded] = useState(false)
  const balance = calculateContractBalance(contract.installments)
  const paidCount = contract.installments?.filter(i => i.status === 'paid').length || 0
  const totalCount = contract.installments?.length || 0
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0

  return (
    <div className="card overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <div className="font-bold text-heading text-sm">{contract.item_description}</div>
              <div className="text-xs text-muted">{formatDate(contract.start_date)} · يوم {contract.due_day}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={getContractStatusClass(contract.status)}>
              {getContractStatusLabel(contract.status)}
            </span>
            {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>{paidCount}/{totalCount} قسط مدفوع</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-danger-500 to-danger-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center">
            <div className="text-xs text-muted">إجمالي</div>
            <div className="font-bold text-sm">{formatCurrency(contract.total_price, symbol)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted">مدفوع</div>
            <div className="font-bold text-sm text-success-600">{formatCurrency(balance.paid, symbol)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted">متبقي عليك</div>
            <div className="font-bold text-sm text-danger-600">{formatCurrency(balance.remaining, symbol)}</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-100 dark:border-surface-700">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>تاريخ الاستحقاق</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {contract.installments?.map(inst => (
                  <tr key={inst.id} className={inst.status === 'paid' ? 'opacity-60' : ''}>
                    <td><span className="font-mono text-xs">{inst.installment_number}</span></td>
                    <td>{formatDate(inst.due_date)}</td>
                    <td>
                      <div>
                        <div className="font-semibold text-sm">{formatCurrency(inst.amount, symbol)}</div>
                        {inst.status === 'partial' && (
                          <div className="text-xs text-warning-600">
                            متبقي: {formatCurrency(inst.remaining_amount, symbol)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={getInstallmentStatusClass(inst.status)}>
                        {getInstallmentStatusLabel(inst.status)}
                      </span>
                    </td>
                    <td>
                      {inst.status !== 'paid' ? (
                        <button onClick={() => onPay(inst)} className="btn-warning btn-sm">
                          سداد
                        </button>
                      ) : (
                        <span className="text-xs text-muted">{formatDate(inst.payment_date)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SupplierDetail() {
  const { id } = useParams()
  const { data: supplier, isLoading, error, refetch } = useSupplier(id)
  const { data: settings } = useSettings()
  const [selectedInstallment, setSelectedInstallment] = useState(null)
  const symbol = settings?.currency_symbol || 'ج.م'

  if (isLoading) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!supplier) return null

  const totalOwed = supplier.contracts?.reduce((sum, c) => {
    const balance = calculateContractBalance(c.installments)
    return sum + balance.remaining
  }, 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/payables" className="btn-ghost btn-icon">
          <ArrowRight size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-heading">{supplier.name}</h1>
          <p className="text-muted text-sm">سجل المورد والمستحقات</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center flex-shrink-0">
            <Store size={28} className="text-danger-600 dark:text-danger-400" />
          </div>
          <div className="flex-1 space-y-1.5">
            <h2 className="text-xl font-bold text-heading">{supplier.name}</h2>
            {supplier.company && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Building2 size={14} />
                <span>{supplier.company}</span>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Phone size={14} />
                <a href={`tel:${supplier.phone}`} className="hover:text-primary-600" dir="ltr">{supplier.phone}</a>
              </div>
            )}
            {supplier.notes && (
              <p className="text-sm text-muted italic">{supplier.notes}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-danger-600 dark:text-danger-400">
              {formatCurrency(totalOwed, symbol)}
            </div>
            <div className="text-xs text-muted">متبقي عليك</div>
          </div>
        </div>
      </div>

      <Link
        to={`/contracts/new?supplier=${id}&type=PAYABLE`}
        className="card p-4 flex items-center gap-3 hover:bg-danger-50 dark:hover:bg-danger-600/10 transition-colors border-2 border-dashed border-danger-300 dark:border-danger-600"
      >
        <div className="w-10 h-10 rounded-xl bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center">
          <Plus size={20} className="text-danger-600" />
        </div>
        <span className="font-medium text-danger-700 dark:text-danger-400">إضافة عقد جديد مع هذا المورد</span>
      </Link>

      <div className="space-y-4">
        <h2 className="font-bold text-heading text-lg">العقود والأقساط</h2>
        {supplier.contracts?.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-muted">لا توجد عقود مع هذا المورد</p>
          </div>
        ) : (
          supplier.contracts?.map(contract => (
            <SupplierContractCard
              key={contract.id}
              contract={contract}
              symbol={symbol}
              onPay={setSelectedInstallment}
            />
          ))
        )}
      </div>

      <PaymentModal
        installment={selectedInstallment}
        isOpen={!!selectedInstallment}
        onClose={() => setSelectedInstallment(null)}
        currencySymbol={symbol}
      />
    </div>
  )
}
