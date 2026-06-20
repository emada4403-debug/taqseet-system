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
import { ArrowRight, Phone, Building2, Store, Plus, FileText, Printer, Calendar, ArrowUpRight, CheckCircle2, DollarSign } from 'lucide-react'

// Unified Supplier Statement Print Template
function SupplierStatementPrintTemplate({ supplier, symbol, businessSettings, ledgerEntries }) {
  if (!supplier) return null

  const businessName = businessSettings?.business_name || 'محل التقسيط'
  const ownerName = businessSettings?.owner_name || 'صاحب العمل'

  const totalPurchases = ledgerEntries.reduce((sum, e) => sum + e.credit, 0)
  const totalPayments = ledgerEntries.reduce((sum, e) => sum + e.debit, 0)
  const netOwed = totalPurchases - totalPayments

  return (
    <div className="print-only w-full p-8 bg-white text-slate-800 space-y-6 dir-rtl text-right">
      {/* Letterhead */}
      <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{businessName}</h1>
          <p className="text-xs text-slate-500 mt-1">كشف حساب مورد موحد (مدين ودائن)</p>
          <p className="text-xs text-slate-500">المالك: {ownerName}</p>
        </div>
        <div className="text-left text-xs text-slate-500">
          <p>التاريخ: {formatDate(new Date().toISOString().split('T')[0])}</p>
        </div>
      </div>

      <div className="text-center py-3 bg-slate-100 rounded-xl">
        <h2 className="text-lg font-bold text-slate-800">كشف حساب مورد: {supplier.name}</h2>
      </div>

      {/* Supplier Profile */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
        <div className="space-y-1.5">
          <div><span className="text-slate-400 ml-2">المورد:</span> <strong className="text-slate-800">{supplier.name}</strong></div>
          {supplier.company && <div><span className="text-slate-400 ml-2">الشركة:</span> <span>{supplier.company}</span></div>}
          {supplier.phone && <div><span className="text-slate-400 ml-2">رقم الهاتف:</span> <span dir="ltr">{supplier.phone}</span></div>}
        </div>
        <div className="space-y-1.5 text-left">
          <div>
            <span className="text-slate-500 font-bold ml-2">إجمالي المشتريات:</span>
            <strong>{formatCurrency(totalPurchases, symbol)}</strong>
          </div>
          <div>
            <span className="text-slate-500 font-bold ml-2">إجمالي المسدد:</span>
            <strong>{formatCurrency(totalPayments, symbol)}</strong>
          </div>
          <div className="pt-2 border-t border-slate-200 mt-2">
            <span className="text-slate-600 font-extrabold ml-2">المتبقي عليك للمورد:</span>
            <strong className="text-danger-600 text-base">{formatCurrency(netOwed, symbol)}</strong>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm">تفاصيل المعاملات المالية</h3>
        <table className="w-full text-xs text-right border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="p-2 border border-slate-200">التاريخ</th>
              <th className="p-2 border border-slate-200">البيان / تفاصيل المعاملة</th>
              <th className="p-2 border border-slate-200">مدين (مدفوعات)</th>
              <th className="p-2 border border-slate-200">دائن (مشتريات)</th>
              <th className="p-2 border border-slate-200">الرصيد المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {ledgerEntries.map((entry, idx) => (
              <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                <td className="p-2 border border-slate-200">{formatDate(entry.date)}</td>
                <td className="p-2 border border-slate-200 font-medium">{entry.description}</td>
                <td className="p-2 border border-slate-200 text-success-700">{entry.debit > 0 ? formatCurrency(entry.debit, symbol) : '-'}</td>
                <td className="p-2 border border-slate-200 text-danger-700">{entry.credit > 0 ? formatCurrency(entry.credit, symbol) : '-'}</td>
                <td className="p-2 border border-slate-200 font-bold">{formatCurrency(entry.balance, symbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="pt-8 grid grid-cols-2 gap-4 text-center text-xs">
        <div>
          <p className="text-slate-400 mb-14">توقيع المستلم (المورد)</p>
          <p className="font-bold border-t border-slate-300 pt-2">{supplier.name}</p>
        </div>
        <div>
          <p className="text-slate-400 mb-14">توقيع المشتري</p>
          <p className="font-bold border-t border-slate-300 pt-2">{ownerName}</p>
        </div>
      </div>
    </div>
  )
}

export default function SupplierDetail() {
  const { id } = useParams()
  const { data: supplier, isLoading, error, refetch } = useSupplier(id)
  const { data: settings } = useSettings()
  
  const [activeTab, setActiveTab] = useState('ledger')
  const [selectedInstallment, setSelectedInstallment] = useState(null)
  
  const symbol = settings?.currency_symbol || 'ج.م'

  if (isLoading) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!supplier) return null

  // 1. Build chronological ledger entries
  const ledgerEntries = []
  
  supplier.contracts?.forEach(contract => {
    // Contract purchases (Credit / دائن)
    ledgerEntries.push({
      date: contract.start_date,
      type: 'purchase',
      description: `شراء بضاعة: ${contract.item_description}`,
      credit: parseFloat(contract.total_price || 0),
      debit: 0,
      original: contract
    })

    // Down payment (Debit / مدين)
    const dp = parseFloat(contract.down_payment || 0)
    if (dp > 0) {
      ledgerEntries.push({
        date: contract.start_date,
        type: 'down_payment',
        description: `دفعة مقدمة لعقد: ${contract.item_description}`,
        credit: 0,
        debit: dp,
        original: contract
      })
    }

    // Payments on installments (Debit / مدين)
    contract.installments?.forEach(inst => {
      inst.payments?.forEach(pay => {
        ledgerEntries.push({
          date: pay.payment_date,
          type: 'payment',
          description: `سداد قسط #${inst.installment_number} لعقد: ${contract.item_description}`,
          credit: 0,
          debit: parseFloat(pay.amount || 0),
          original: pay
        })
      })
    })
  })

  // Sort chronologically ascending
  ledgerEntries.sort((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)
    if (dateA < dateB) return -1
    if (dateA > dateB) return 1

    const order = { purchase: 1, down_payment: 2, payment: 3 }
    return order[a.type] - order[b.type]
  })

  // Calculate Running Balance
  let runningBal = 0
  const entriesWithBalance = ledgerEntries.map(entry => {
    runningBal = runningBal + entry.credit - entry.debit
    return {
      ...entry,
      balance: runningBal
    }
  })

  // 2. Fetch unpaid installments list to easily record payments
  const unpaidInstallments = []
  supplier.contracts?.forEach(contract => {
    contract.installments?.forEach(inst => {
      if (inst.status !== 'paid') {
        unpaidInstallments.push({
          ...inst,
          contract
        })
      }
    })
  })
  unpaidInstallments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))

  // Calculations for Stat Cards
  const totalPurchases = ledgerEntries.reduce((sum, e) => sum + e.credit, 0)
  const totalPaid = ledgerEntries.reduce((sum, e) => sum + e.debit, 0)
  const netOwed = totalPurchases - totalPaid

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link to="/payables" className="btn-ghost btn-icon">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-heading">كشف حساب المورد</h1>
            <p className="text-muted text-sm">{supplier.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="btn-success flex items-center gap-1.5">
            <Printer size={16} />
            <span>طباعة كشف الحساب</span>
          </button>
          <button
            onClick={() => {
              if (unpaidInstallments.length === 0) {
                alert('لا توجد أقساط مستحقة لهذا المورد حالياً ✓')
                return
              }
              setSelectedInstallment(unpaidInstallments[0])
            }}
            className="btn bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 border border-amber-600 shadow-sm"
          >
            <DollarSign size={16} />
            <span>سداد دفعة</span>
          </button>
          <Link
            to={`/contracts/new?supplier=${supplier.id}&type=PAYABLE`}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>عقد شراء جديد</span>
          </Link>
        </div>
      </div>

      {/* Supplier Info Card */}
      <div className="card p-5 no-print">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center flex-shrink-0">
            <Store size={28} className="text-danger-600 dark:text-danger-400" />
          </div>
          <div className="flex-1 space-y-1">
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
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="card p-4 border-r-4 border-slate-500">
          <span className="text-xs text-muted block">إجمالي قيمة المشتريات</span>
          <span className="text-xl font-bold text-heading block mt-1">{formatCurrency(totalPurchases, symbol)}</span>
        </div>
        <div className="card p-4 border-r-4 border-success-500">
          <span className="text-xs text-muted block">إجمالي المبالغ المسددة</span>
          <span className="text-xl font-bold text-success-600 block mt-1">{formatCurrency(totalPaid, symbol)}</span>
        </div>
        <div className="card p-4 border-r-4 border-danger-500">
          <span className="text-xs text-muted block">صافي الرصيد المتبقي عليك</span>
          <span className="text-xl font-bold text-danger-600 block mt-1">{formatCurrency(netOwed, symbol)}</span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl no-print">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeTab === 'ledger'
              ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
              : 'text-muted hover:text-heading'
          }`}
        >
          كشف الحساب الموحد
        </button>
        <button
          onClick={() => setActiveTab('installments')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeTab === 'installments'
              ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
              : 'text-muted hover:text-heading'
          }`}
        >
          الأقساط المستحقة ({unpaidInstallments.length})
        </button>
      </div>

      {/* Ledger Tab Content */}
      {activeTab === 'ledger' && (
        <div className="card overflow-hidden no-print">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50">
            <h3 className="font-bold text-heading text-sm">دفتر الأستاذ المساعد للمورد</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table text-right text-xs">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800">
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">البيان والتفاصيل</th>
                  <th className="p-3">مدين (مدفوعات)</th>
                  <th className="p-3">دائن (مشتريات)</th>
                  <th className="p-3">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {entriesWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-muted text-sm">
                      لا توجد معاملات مسجلة لهذا المورد حتى الآن.
                    </td>
                  </tr>
                ) : (
                  entriesWithBalance.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-surface-50/50">
                      <td className="p-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="p-3 font-semibold text-heading">{entry.description}</td>
                      <td className="p-3 font-bold text-success-600">
                        {entry.debit > 0 ? `-${formatCurrency(entry.debit, symbol)}` : '-'}
                      </td>
                      <td className="p-3 font-bold text-danger-600">
                        {entry.credit > 0 ? `+${formatCurrency(entry.credit, symbol)}` : '-'}
                      </td>
                      <td className="p-3 font-mono font-bold text-heading bg-surface-50/30">
                        {formatCurrency(entry.balance, symbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unpaid Installments Tab Content */}
      {activeTab === 'installments' && (
        <div className="card overflow-hidden no-print">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50">
            <h3 className="font-bold text-heading text-sm">الأقساط المستحقة للمورد</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table text-right text-xs">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800">
                  <th className="p-3">العقد / السلعة</th>
                  <th className="p-3">رقم القسط</th>
                  <th className="p-3">تاريخ الاستحقاق</th>
                  <th className="p-3">المبلغ المطلوب</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {unpaidInstallments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-success-600 text-sm font-bold">
                      🎉 جميع الأقساط مسددة بالكامل! لا توجد مستحقات معلقة للمورد.
                    </td>
                  </tr>
                ) : (
                  unpaidInstallments.map(inst => (
                    <tr key={inst.id}>
                      <td className="p-3 font-semibold text-heading">{inst.contract?.item_description}</td>
                      <td className="p-3 font-mono">قسط #{inst.installment_number}</td>
                      <td className="p-3">{formatDate(inst.due_date)}</td>
                      <td className="p-3">
                        <div className="font-bold text-heading">{formatCurrency(inst.remaining_amount, symbol)}</div>
                        {inst.status === 'partial' && (
                          <div className="text-[10px] text-warning-600 font-medium">المتبقي للقسط</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={getInstallmentStatusClass(inst.status)}>
                          {getInstallmentStatusLabel(inst.status)}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setSelectedInstallment({ ...inst, contracts: inst.contract })}
                          className="btn-warning btn-sm"
                        >
                          سداد
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        installment={selectedInstallment}
        isOpen={!!selectedInstallment}
        onClose={() => setSelectedInstallment(null)}
        currencySymbol={symbol}
      />

      {/* Print Ledger Template */}
      <SupplierStatementPrintTemplate
        supplier={supplier}
        symbol={symbol}
        businessSettings={settings}
        ledgerEntries={entriesWithBalance}
      />
    </div>
  )
}
