import { useState } from 'react'
import { useRecordPayment } from '@/hooks/useApi'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate, getInstallmentStatusLabel } from '@/lib/utils'
import Modal from './Modal'
import { DollarSign, Calendar, CreditCard, FileText, Hash } from 'lucide-react'

const METHODS = [
  { value: 'cash', label: 'نقدي' },
  { value: 'transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
]

export default function PaymentModal({ installment, isOpen, onClose, currencySymbol = 'ج.م' }) {
  const toast = useToast()
  const recordPayment = useRecordPayment()
  const [form, setForm] = useState({
    amount: '',
    method: 'cash',
    referenceNumber: '',
    notes: '',
    paymentDate: new Date().toISOString().split('T')[0],
  })

  if (!installment) return null

  const maxAmount = parseFloat(installment.remaining_amount || installment.amount)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)

    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    if (amount > maxAmount) {
      toast.error(`المبلغ لا يمكن أن يتجاوز ${formatCurrency(maxAmount, currencySymbol)}`)
      return
    }

    try {
      await recordPayment.mutateAsync({
        installmentId: installment.id,
        amount,
        method: form.method,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
        paymentDate: form.paymentDate,
      })
      toast.success('تم تسجيل الدفعة بنجاح ✓')
      onClose()
      setForm({ amount: '', method: 'cash', referenceNumber: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] })
    } catch (err) {
      toast.error(err.message || 'فشل تسجيل الدفعة')
    }
  }

  const contractInfo = installment.contracts
  const partyName = contractInfo?.clients?.name || contractInfo?.suppliers?.name || 'غير محدد'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل دفعة"
      footer={
        <div className="flex gap-3 w-full">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            إلغاء
          </button>
          <button
            type="submit"
            form="payment-form"
            className="btn-success flex-1"
            disabled={recordPayment.isPending}
          >
            {recordPayment.isPending ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
          </button>
        </div>
      }
    >
      {/* Installment Info Card */}
      <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4 space-y-2 -mt-1">
        <div className="flex items-center justify-between">
          <span className="text-muted text-xs">الطرف</span>
          <span className="font-semibold text-heading text-sm">{partyName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-xs">رقم القسط</span>
          <span className="font-medium text-sm">
            {installment.installment_number}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-xs">تاريخ الاستحقاق</span>
          <span className="font-medium text-sm">{formatDate(installment.due_date)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-surface-200 dark:border-surface-600 pt-2 mt-2">
          <span className="text-muted text-xs font-semibold">المبلغ المتبقي</span>
          <span className="font-bold text-danger-600 dark:text-danger-400">
            {formatCurrency(maxAmount, currencySymbol)}
          </span>
        </div>
      </div>

      <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div className="form-group">
          <label className="label">
            <DollarSign size={14} className="inline-block ml-1" />
            المبلغ المدفوع *
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={maxAmount}
              className="input pl-16"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">
              {currencySymbol}
            </span>
          </div>
          <div className="flex gap-2 mt-1.5">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setForm(f => ({ ...f, amount: maxAmount.toString() }))}
            >
              الكل ({formatCurrency(maxAmount, currencySymbol)})
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setForm(f => ({ ...f, amount: (maxAmount / 2).toFixed(2) }))}
            >
              النصف
            </button>
          </div>
        </div>

        {/* Payment Date */}
        <div className="form-group">
          <label className="label">
            <Calendar size={14} className="inline-block ml-1" />
            تاريخ الدفع *
          </label>
          <input
            type="date"
            className="input"
            value={form.paymentDate}
            onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
            required
          />
        </div>

        {/* Method */}
        <div className="form-group">
          <label className="label">
            <CreditCard size={14} className="inline-block ml-1" />
            طريقة الدفع
          </label>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, method: m.value }))}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                  form.method === m.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'border-surface-200 dark:border-surface-600 text-muted hover:border-primary-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reference Number */}
        {form.method !== 'cash' && (
          <div className="form-group">
            <label className="label">
              <Hash size={14} className="inline-block ml-1" />
              رقم المرجع / الشيك
            </label>
            <input
              type="text"
              className="input"
              placeholder="اختياري"
              value={form.referenceNumber}
              onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
            />
          </div>
        )}

        {/* Notes */}
        <div className="form-group">
          <label className="label">
            <FileText size={14} className="inline-block ml-1" />
            ملاحظات
          </label>
          <textarea
            className="input"
            rows={2}
            placeholder="اختياري"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </form>
    </Modal>
  )
}
