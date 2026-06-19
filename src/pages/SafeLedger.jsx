import { useState } from 'react'
import {
  useSafeTransactions,
  useSafeSummary,
  useCreateManualSafeTransaction,
  useExpenses,
  useCreateExpense,
  useSettings
} from '@/hooks/useApi'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader, ErrorState } from '@/components/ui/States'
import Modal from '@/components/ui/Modal'
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Plus,
  Calendar, FileText, Filter, RotateCcw, AlertCircle, TrendingUp, DollarSign
} from 'lucide-react'

const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'إيجار' },
  { value: 'electricity', label: 'كهرباء ومياه' },
  { value: 'salaries', label: 'رواتب وأجور' },
  { value: 'marketing', label: 'تسويق ودعاية' },
  { value: 'maintenance', label: 'صيانة وإصلاحات' },
  { value: 'other', label: 'أخرى' }
]

const TRANSACTION_CATEGORIES = {
  payment_received: 'تحصيل قسط عميل',
  supplier_paid: 'سداد قسط مورد',
  expense: 'مصروفات تشغيلية',
  manual_deposit: 'إيداع يدوي',
  manual_withdrawal: 'سحب يدوي',
  contract_downpayment: 'مقدم عقد'
}

export default function SafeLedger() {
  const toast = useToast()
  const { data: settings } = useSettings()
  const symbol = settings?.currency_symbol || 'ج.م'

  // Tabs: 'safe' (حركة الخزينة) or 'expenses' (المصروفات)
  const [activeTab, setActiveTab] = useState('safe')

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    date_from: '',
    date_to: ''
  })

  // Queries
  const { data: summary, isLoading: isSummaryLoading, error: summaryError, refetch: refetchSummary } = useSafeSummary()
  const { data: transactions, isLoading: isTransLoading, error: transError, refetch: refetchTrans } = useSafeTransactions(filters)
  const { data: expenses, isLoading: isExpensesLoading, error: expError, refetch: refetchExpenses } = useExpenses(filters)

  // Mutations
  const createManualTx = useCreateManualSafeTransaction()
  const createExpense = useCreateExpense()

  // Modal States
  const [txModal, setTxModal] = useState({ isOpen: false, type: 'deposit' }) // type: 'deposit' | 'withdrawal'
  const [expenseModal, setExpenseModal] = useState(false)

  // Form States
  const [txForm, setTxForm] = useState({
    amount: '',
    category: 'manual_deposit',
    notes: '',
    transaction_date: new Date().toISOString().split('T')[0]
  })

  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'other',
    notes: '',
    expense_date: new Date().toISOString().split('T')[0]
  })

  const handleTxSubmit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(txForm.amount)
    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }

    try {
      await createManualTx.mutateAsync({
        type: txModal.type,
        amount,
        category: txModal.type === 'deposit' ? 'manual_deposit' : 'manual_withdrawal',
        notes: txForm.notes,
        transaction_date: txForm.transaction_date
      })
      toast.success('تم تسجيل حركة الخزينة بنجاح ✓')
      setTxModal({ isOpen: false, type: 'deposit' })
      setTxForm({
        amount: '',
        category: 'manual_deposit',
        notes: '',
        transaction_date: new Date().toISOString().split('T')[0]
      })
      refetchSummary()
      refetchTrans()
    } catch (err) {
      toast.error(err.message || 'فشل تسجيل المعاملة')
    }
  }

  const handleExpenseSubmit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(expenseForm.amount)
    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    if (!expenseForm.title.trim()) {
      toast.error('يرجى إدخال عنوان المصروف')
      return
    }

    try {
      await createExpense.mutateAsync({
        title: expenseForm.title,
        amount,
        category: expenseForm.category,
        notes: expenseForm.notes,
        expense_date: expenseForm.expense_date
      })
      toast.success('تم تسجيل المصروف بنجاح ✓')
      setExpenseModal(false)
      setExpenseForm({
        title: '',
        amount: '',
        category: 'other',
        notes: '',
        expense_date: new Date().toISOString().split('T')[0]
      })
      refetchSummary()
      refetchTrans()
      refetchExpenses()
    } catch (err) {
      toast.error(err.message || 'فشل تسجيل المصروف')
    }
  }

  const handleResetFilters = () => {
    setFilters({
      type: '',
      category: '',
      date_from: '',
      date_to: ''
    })
  }

  if (isSummaryLoading || isTransLoading || isExpensesLoading) return <PageLoader />
  if (summaryError || transError || expError) {
    return (
      <ErrorState
        error={summaryError || transError || expError}
        onRetry={() => {
          refetchSummary()
          refetchTrans()
          refetchExpenses()
        }}
      />
    )
  }

  const balance = summary?.balance || 0
  const totalDeposits = summary?.totalDeposits || 0
  const totalWithdrawals = summary?.totalWithdrawals || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">دفتر الخزينة والمصروفات</h1>
          <p className="text-muted text-sm">مراقبة السيولة النقدية، الإيداعات، والمصاريف الإدارية للمحل</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setTxModal({ isOpen: true, type: 'deposit' })
              setTxForm(f => ({ ...f, category: 'manual_deposit' }))
            }}
            className="btn-success flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>إيداع نقدي</span>
          </button>
          <button
            onClick={() => {
              setTxModal({ isOpen: true, type: 'withdrawal' })
              setTxForm(f => ({ ...f, category: 'manual_withdrawal' }))
            }}
            className="btn-danger flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>سحب نقدي</span>
          </button>
          <button
            onClick={() => setExpenseModal(true)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>تسجيل مصروف</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Balance Card */}
        <div className="card p-5 relative overflow-hidden bg-gradient-to-br from-primary-500/10 via-primary-600/5 to-transparent border-primary-200/50 dark:border-primary-800/30">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-muted text-xs font-semibold block">السيولة الحالية بالخزينة</span>
              <span className={`text-3xl font-extrabold tracking-tight block ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-danger-600'}`}>
                {formatCurrency(balance, symbol)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
              <Wallet size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[11px] text-muted">
            <div className={`w-2.5 h-2.5 rounded-full ${balance >= 0 ? 'bg-green-500 pulse-ring' : 'bg-danger-500'}`} />
            <span>الحالة المالية: الخزينة {balance >= 0 ? 'نشطة ومتوفر سيولة' : 'في حالة عجز مالي'}</span>
          </div>
        </div>

        {/* Total Inflows */}
        <div className="card p-5 relative overflow-hidden bg-gradient-to-br from-success-500/10 via-success-600/5 to-transparent border-success-200/50 dark:border-success-800/30">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-muted text-xs font-semibold block">إجمالي المقبوضات والوارد</span>
              <span className="text-3xl font-extrabold tracking-tight text-success-600 dark:text-success-400 block">
                {formatCurrency(totalDeposits, symbol)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-success-100 dark:bg-success-950/30 flex items-center justify-center text-success-600 dark:text-success-400">
              <ArrowUpRight size={24} />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-4">
            تشمل تحصيل الأقساط ومقدمات العقود والإيداعات اليدوية.
          </p>
        </div>

        {/* Total Outflows */}
        <div className="card p-5 relative overflow-hidden bg-gradient-to-br from-danger-500/10 via-danger-600/5 to-transparent border-danger-200/50 dark:border-danger-800/30">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-muted text-xs font-semibold block">إجمالي المدفوعات والمنصرف</span>
              <span className="text-3xl font-extrabold tracking-tight text-danger-600 dark:text-danger-400 block">
                {formatCurrency(totalWithdrawals, symbol)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-danger-100 dark:bg-danger-950/30 flex items-center justify-center text-danger-600 dark:text-danger-400">
              <ArrowDownLeft size={24} />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-4">
            تشمل المصاريف الإدارية والمدفوعات للموردين والسحوبات اليدوية.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200 dark:border-surface-700 flex gap-4">
        <button
          onClick={() => setActiveTab('safe')}
          className={`pb-3 font-semibold text-sm transition-colors border-b-2 px-1 ${
            activeTab === 'safe'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-muted hover:text-heading'
          }`}
        >
          حركة الخزينة التفصيلية ({transactions?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 font-semibold text-sm transition-colors border-b-2 px-1 ${
            activeTab === 'expenses'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-muted hover:text-heading'
          }`}
        >
          المصروفات التشغيلية ({expenses?.length || 0})
        </button>
      </div>

      {/* Filters Form */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-heading">
          <Filter size={16} className="text-primary-500" />
          <span>تصفية النتائج والبحث</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {activeTab === 'safe' && (
            <div className="form-group">
              <label className="label text-[11px]">نوع الحركة</label>
              <select
                className="input py-1.5 text-xs"
                value={filters.type}
                onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
              >
                <option value="">كل الحركات</option>
                <option value="deposit">وارد / إيداع</option>
                <option value="withdrawal">منصرف / سحب</option>
              </select>
            </div>
          )}

          {activeTab === 'safe' ? (
            <div className="form-group">
              <label className="label text-[11px]">تصنيف المعاملة</label>
              <select
                className="input py-1.5 text-xs"
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">كل التصنيفات</option>
                {Object.entries(TRANSACTION_CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="label text-[11px]">تصنيف المصروف</label>
              <select
                className="input py-1.5 text-xs"
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">كل التصنيفات</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="label text-[11px]">من تاريخ</label>
            <input
              type="date"
              className="input py-1.5 text-xs"
              value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="label text-[11px]">إلى تاريخ</label>
            <input
              type="date"
              className="input py-1.5 text-xs"
              value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            />
          </div>
        </div>

        {(filters.type || filters.category || filters.date_from || filters.date_to) && (
          <div className="flex justify-end">
            <button
              onClick={handleResetFilters}
              className="btn-secondary btn-sm flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>إعادة تعيين الفلاتر</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      {activeTab === 'safe' ? (
        <div className="card overflow-hidden">
          {transactions?.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <AlertCircle className="mx-auto text-muted" size={32} />
              <p className="text-muted text-sm">لا توجد عمليات مسجلة بالخزنة تطابق الفلاتر المحددة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table text-right text-xs">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800">
                    <th className="p-3">تاريخ الحركة</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">التفاصيل والبيان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {transactions?.map((tx) => {
                    const partyName =
                      tx.contracts?.clients?.name ||
                      tx.contracts?.suppliers?.name ||
                      tx.payments?.installments?.contracts?.clients?.name ||
                      tx.payments?.installments?.contracts?.suppliers?.name ||
                      ''

                    return (
                      <tr key={tx.id} className="hover:bg-surface-50/50">
                        <td className="p-3 whitespace-nowrap">{formatDate(tx.transaction_date)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tx.type === 'deposit'
                              ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                          }`}>
                            {tx.type === 'deposit' ? 'وارد / إيداع' : 'منصرف / سحب'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-medium text-heading">
                            {TRANSACTION_CATEGORIES[tx.category] || tx.category}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap font-bold text-sm">
                          <span className={tx.type === 'deposit' ? 'text-green-600' : 'text-danger-600'}>
                            {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, symbol)}
                          </span>
                        </td>
                        <td className="p-3 text-muted max-w-xs truncate">
                          {tx.notes} {partyName && <strong className="text-heading">({partyName})</strong>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {expenses?.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <AlertCircle className="mx-auto text-muted" size={32} />
              <p className="text-muted text-sm">لا توجد مصروفات مسجلة تطابق الفلاتر المحددة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table text-right text-xs">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800">
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">بند المصروف</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {expenses?.map((exp) => (
                    <tr key={exp.id} className="hover:bg-surface-50/50">
                      <td className="p-3 whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                      <td className="p-3 whitespace-nowrap font-bold text-heading">{exp.title}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-heading text-[10px]">
                          {EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label || exp.category}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-bold text-sm text-danger-600">
                        {formatCurrency(exp.amount, symbol)}
                      </td>
                      <td className="p-3 text-muted max-w-xs truncate">{exp.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Manual Transaction (Deposit/Withdrawal) */}
      <Modal
        isOpen={txModal.isOpen}
        onClose={() => setTxModal(m => ({ ...m, isOpen: false }))}
        title={txModal.type === 'deposit' ? 'إيداع نقدي بالخزينة' : 'سحب نقدي من الخزينة'}
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setTxModal(m => ({ ...m, isOpen: false }))}
              className="btn-secondary flex-1"
            >
              إلغاء
            </button>
            <button
              form="tx-form"
              type="submit"
              className={txModal.type === 'deposit' ? 'btn-success flex-1' : 'btn-danger flex-1'}
              disabled={createManualTx.isPending}
            >
              {createManualTx.isPending ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
            </button>
          </div>
        }
      >
        <form id="tx-form" onSubmit={handleTxSubmit} className="space-y-4">
          <div className="form-group">
            <label className="label">المبلغ المطلوب *</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input pl-14"
                placeholder="0.00"
                value={txForm.amount}
                onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">
                {symbol}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="label">تاريخ الحركة *</label>
            <input
              type="date"
              className="input"
              value={txForm.transaction_date}
              onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">البيان والملاحظات</label>
            <textarea
              className="input"
              rows={3}
              placeholder="مثال: زيادة رأس مال المحل، سحب خاص بالمالك..."
              value={txForm.notes}
              onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Create Expense */}
      <Modal
        isOpen={expenseModal}
        onClose={() => setExpenseModal(false)}
        title="تسجيل مصروف تشغيلي جديد"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setExpenseModal(false)}
              className="btn-secondary flex-1"
            >
              إلغاء
            </button>
            <button
              form="expense-form"
              type="submit"
              className="btn-primary flex-1"
              disabled={createExpense.isPending}
            >
              {createExpense.isPending ? 'جاري الحفظ...' : 'تأكيد وتسجيل'}
            </button>
          </div>
        }
      >
        <form id="expense-form" onSubmit={handleExpenseSubmit} className="space-y-4">
          <div className="form-group">
            <label className="label">بند المصروف (العنوان) *</label>
            <input
              type="text"
              className="input"
              placeholder="مثال: إيجار شهر يونيو، فاتورة الكهرباء..."
              value={expenseForm.title}
              onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">المبلغ *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input pl-14"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">
                  {symbol}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="label">التصنيف *</label>
              <select
                className="input"
                value={expenseForm.category}
                onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                required
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">تاريخ المصروف *</label>
            <input
              type="date"
              className="input"
              value={expenseForm.expense_date}
              onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">ملاحظات إضافية</label>
            <textarea
              className="input"
              rows={2}
              placeholder="اختياري"
              value={expenseForm.notes}
              onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
