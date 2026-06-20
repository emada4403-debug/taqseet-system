import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClients, useSuppliers, useCreateContract, useSettings } from '@/hooks/useApi'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate, generateInstallmentDates } from '@/lib/utils'
import { ArrowRight, Calculator, Calendar, FileText, User, Store, Info } from 'lucide-react'

const STEPS = ['نوع الفاتورة', 'بيانات الفاتورة', 'مراجعة وتأكيد']

export default function NewContract() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: clients } = useClients()
  const { data: suppliers } = useSuppliers()
  const { data: settings } = useSettings()
  const createContract = useCreateContract()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [purchaseMethod, setPurchaseMethod] = useState('credit') // 'credit' | 'cash'
  const [form, setForm] = useState({
    type: searchParams.get('type') || 'RECEIVABLE',
    client_id: searchParams.get('client') || '',
    supplier_id: searchParams.get('supplier') || '',
    item_description: '',
    purchase_price: '',
    total_price: '',
    down_payment: '0',
    installment_count: '12',
    due_day: settings?.default_due_day?.toString() || '1',
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const symbol = settings?.currency_symbol || 'ج.م'

  // Calculated values
  const totalPrice = parseFloat(form.total_price) || 0
  const downPayment = purchaseMethod === 'cash' ? totalPrice : (parseFloat(form.down_payment) || 0)
  const installmentCount = purchaseMethod === 'cash' ? 0 : (parseInt(form.installment_count) || 1)
  const remaining = purchaseMethod === 'cash' ? 0 : (totalPrice - downPayment)
  const installmentAmount = purchaseMethod === 'cash' ? 0 : (remaining > 0 ? remaining / installmentCount : 0)

  // Preview installment dates
  const installmentDates = purchaseMethod === 'credit' && form.start_date ? generateInstallmentDates(
    form.start_date, installmentCount, parseInt(form.due_day)
  ) : []

  const isReceivable = form.type === 'RECEIVABLE'

  const validate = () => {
    if (step === 0) {
      if (isReceivable && !form.client_id) { toast.error('يرجى اختيار العميل'); return false }
      if (!isReceivable && !form.supplier_id) { toast.error('يرجى اختيار المورد'); return false }
    }
    if (step === 1) {
      if (!form.item_description) { toast.error('يرجى إدخال وصف البضاعة'); return false }
      if (isReceivable && (!form.purchase_price || parseFloat(form.purchase_price) <= 0)) { toast.error('يرجى إدخال سعر الشراء'); return false }
      if (!totalPrice || totalPrice <= 0) { toast.error('يرجى إدخال السعر الإجمالي'); return false }
      if (purchaseMethod === 'credit' && downPayment >= totalPrice) { toast.error('المقدم يجب أن يكون أقل من الإجمالي'); return false }
    }
    return true
  }

  const handleNext = () => {
    if (validate()) setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    try {
      const purchasePrice = isReceivable ? (parseFloat(form.purchase_price) || 0) : totalPrice
      const profit = isReceivable ? (totalPrice - purchasePrice) : 0

      const contractData = {
        type: form.type,
        client_id: isReceivable ? form.client_id || null : null,
        supplier_id: !isReceivable ? form.supplier_id || null : null,
        item_description: form.item_description,
        purchase_price: purchasePrice,
        total_price: totalPrice,
        profit: profit,
        down_payment: downPayment,
        installment_count: installmentCount,
        installment_amount: installmentAmount,
        start_date: form.start_date,
        due_day: purchaseMethod === 'cash' ? 1 : parseInt(form.due_day),
        notes: form.notes || null,
        status: purchaseMethod === 'cash' ? 'completed' : 'active',
      }

      const installments = installmentDates.map(date => ({
        due_date: date.toISOString().split('T')[0],
        amount: installmentAmount,
      }))

      const result = await createContract.mutateAsync({ contractData, installments, isCash: purchaseMethod === 'cash' })
      toast.success('تم إنشاء العقد بنجاح ✓')

      if (isReceivable) {
        navigate(`/receivables/${form.client_id}`)
      } else {
        navigate(`/payables/${form.supplier_id}`)
      }
    } catch (err) {
      toast.error(err.message || 'فشل إنشاء العقد')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)} className="btn-ghost btn-icon">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-heading">إنشاء فاتورة جديدة</h1>
          <p className="text-muted text-sm">الخطوة {step + 1} من {STEPS.length}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col gap-1.5">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-700'
            }`} />
            <span className={`text-xs text-center ${i === step ? 'text-primary-600 font-semibold' : 'text-muted'}`}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 0: Type & Party */}
      {step === 0 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-bold text-heading">نوع الفاتورة المعاملة</h2>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setForm(f => ({ ...f, type: 'RECEIVABLE', supplier_id: '' }))}
              className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                form.type === 'RECEIVABLE'
                  ? 'border-success-500 bg-success-50 dark:bg-success-600/10'
                  : 'border-surface-200 dark:border-surface-600 hover:border-success-300'
              }`}
            >
              <div className="text-3xl mb-2">📥</div>
              <div className="font-bold text-sm text-heading">فاتورة بيع (لعميل)</div>
              <div className="text-xs text-muted mt-1">بيع أجهزة وتليفونات بالتقسيط أو نقداً</div>
            </button>
            <button
              onClick={() => setForm(f => ({ ...f, type: 'PAYABLE', client_id: '' }))}
              className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                form.type === 'PAYABLE'
                  ? 'border-danger-500 bg-danger-50 dark:bg-danger-600/10'
                  : 'border-surface-200 dark:border-surface-600 hover:border-danger-300'
              }`}
            >
              <div className="text-3xl mb-2">📤</div>
              <div className="font-bold text-sm text-heading">فاتورة شراء (من مورد)</div>
              <div className="text-xs text-muted mt-1">شراء أجهزة وتليفونات بالتقسيط أو نقداً</div>
            </button>
          </div>

          {/* Party selector */}
          <div className="form-group">
            <label className="label">
              {isReceivable ? (
                <><User size={14} className="inline ml-1" />اختر العميل *</>
              ) : (
                <><Store size={14} className="inline ml-1" />اختر المورد *</>
              )}
            </label>
            {isReceivable ? (
              <select
                className="input"
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                required
              >
                <option value="">-- اختر العميل --</option>
                {clients?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <select
                className="input"
                value={form.supplier_id}
                onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                required
              >
                <option value="">-- اختر المورد --</option>
                {suppliers?.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ''}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted mt-1">
              {isReceivable
                ? 'إذا لم يكن موجوداً، اذهب إلى المديونيات وأضف العميل أولاً'
                : 'إذا لم يكن موجوداً، اذهب إلى المستحقات وأضف المورد أولاً'
              }
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: Contract Details */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-bold text-heading">بيانات العقد</h2>

          <div className="form-group">
            <label className="label"><FileText size={14} className="inline ml-1" />وصف البضاعة / الخدمة *</label>
            <input className="input" placeholder="مثال: تلفزيون سامسونج..." value={form.item_description}
              onChange={e => setForm(f => ({ ...f, item_description: e.target.value }))} required />
          </div>

          {/* طريقة التعامل */}
          <div className="form-group">
            <label className="label">طريقة التعامل والدفع *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPurchaseMethod('credit')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                  purchaseMethod === 'credit'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'border-surface-200 dark:border-surface-700 text-muted hover:border-primary-300'
                }`}
              >
                تقسيط / آجل (حساب العميل/المورد)
              </button>
              <button
                type="button"
                onClick={() => setPurchaseMethod('cash')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                  purchaseMethod === 'cash'
                    ? 'border-success-500 bg-success-50 dark:bg-success-950/20 text-success-700 dark:text-success-400'
                    : 'border-surface-200 dark:border-surface-700 text-muted hover:border-success-300'
                }`}
              >
                نقدي (كاش - حركة خزينة مباشرة)
              </button>
            </div>
          </div>

          {purchaseMethod === 'cash' ? (
            /* CASH LAYOUT */
            isReceivable ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">سعر الشراء (التكلفة) *</label>
                  <div className="relative">
                    <input type="number" className="input pl-14" placeholder="0"
                      value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} required />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">سعر البيع الكاش *</label>
                  <div className="relative">
                    <input type="number" className="input pl-14" placeholder="0"
                      value={form.total_price} onChange={e => setForm(f => ({ ...f, total_price: e.target.value }))} required />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="label">سعر الشراء الكاش *</label>
                <div className="relative">
                  <input type="number" className="input pl-14" placeholder="0"
                    value={form.total_price} onChange={e => setForm(f => ({ ...f, total_price: e.target.value }))} required />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                </div>
              </div>
            )
          ) : (
            /* CREDIT/INSTALLMENT LAYOUT */
            isReceivable ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label">سعر الشراء (التكلفة) *</label>
                    <div className="relative">
                      <input type="number" className="input pl-14" placeholder="0"
                        value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} required />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">سعر البيع (الإجمالي) *</label>
                    <div className="relative">
                      <input type="number" className="input pl-14" placeholder="0"
                        value={form.total_price} onChange={e => setForm(f => ({ ...f, total_price: e.target.value }))} required />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                    </div>
                  </div>
                </div>

                {parseFloat(form.total_price) > 0 && parseFloat(form.purchase_price) > 0 && (
                  <div className="bg-success-50 dark:bg-success-950/20 text-success-800 dark:text-success-300 rounded-xl p-3 text-xs flex justify-between font-bold">
                    <span>الربح المحتسب:</span>
                    <span>{formatCurrency(parseFloat(form.total_price) - parseFloat(form.purchase_price), symbol)}</span>
                  </div>
                )}
                
                <div className="form-group">
                  <label className="label">المقدم / الدفعة الأولى</label>
                  <div className="relative">
                    <input type="number" className="input pl-14" placeholder="0"
                      value={form.down_payment} onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">سعر الشراء *</label>
                  <div className="relative">
                    <input type="number" className="input pl-14" placeholder="0"
                      value={form.total_price} onChange={e => setForm(f => ({ ...f, total_price: e.target.value }))} required />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">المقدم / الدفعة الأولى</label>
                  <div className="relative">
                    <input type="number" className="input pl-14" placeholder="0"
                      value={form.down_payment} onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{symbol}</span>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Conditional Installment Options */}
          {purchaseMethod === 'credit' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">عدد الأقساط</label>
                <input type="number" className="input" placeholder="12" min="1" max="120"
                  value={form.installment_count} onChange={e => setForm(f => ({ ...f, installment_count: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">يوم الاستحقاق من الشهر</label>
                <input type="number" className="input" placeholder="1" min="1" max="28"
                  value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="label"><Calendar size={14} className="inline ml-1" />تاريخ البداية / المعاملة</label>
            <input type="date" className="input" value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>

          {/* Auto-calculated preview */}
          {purchaseMethod === 'credit' && totalPrice > 0 && (
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Calculator size={16} className="text-primary-600" />
                <span className="font-bold text-primary-700 dark:text-primary-400 text-sm">حساب تلقائي</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">المبلغ المتبقي للتقسيط</span>
                <span className="font-bold">{formatCurrency(remaining, symbol)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">قيمة كل قسط</span>
                <span className="font-bold text-primary-700 dark:text-primary-400 text-base">
                  {formatCurrency(installmentAmount, symbol)}
                </span>
              </div>
            </div>
          )}

          {purchaseMethod === 'cash' && isReceivable && totalPrice > 0 && parseFloat(form.purchase_price) > 0 && (
            <div className="bg-success-50 dark:bg-success-950/20 rounded-xl p-4 space-y-2 font-bold text-success-800 dark:text-success-300 text-sm flex justify-between">
              <span>صافي الربح المحقق فوراً:</span>
              <span>{formatCurrency(totalPrice - parseFloat(form.purchase_price), symbol)}</span>
            </div>
          )}

          <div className="form-group">
            <label className="label">ملاحظات</label>
            <textarea className="input" rows={2} placeholder="اختياري..."
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      )}

      {/* STEP 2: Review */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-bold text-heading mb-4">مراجعة العقد</h2>

            <div className="space-y-3">
              {[
                { label: 'نوع العقد والتعامل', value: isReceivable 
                  ? (purchaseMethod === 'cash' ? '📥 بيع نقدي (كاش)' : '📥 مديونية تقسيط (عميل)') 
                  : (purchaseMethod === 'cash' ? '📤 شراء نقدي (كاش)' : '📤 مستحقة تقسيط (مورد)') },
                { label: 'البضاعة', value: form.item_description },
                { label: 'القيمة المالية', value: formatCurrency(totalPrice, symbol) },
                ...(purchaseMethod === 'credit' ? [
                  { label: 'المقدم', value: formatCurrency(downPayment, symbol) },
                  { label: 'عدد الأقساط', value: `${installmentCount} قسط` },
                  { label: 'قيمة كل قسط', value: formatCurrency(installmentAmount, symbol) },
                  { label: 'يوم الاستحقاق', value: `${form.due_day} من كل شهر` },
                ] : [
                  { label: 'حالة الدفع', value: 'سداد نقدي فوري بالخزينة' }
                ]),
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm py-1.5 border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <span className="text-muted">{item.label}</span>
                  <span className="font-semibold text-heading">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Installment Schedule Preview */}
          {purchaseMethod === 'credit' ? (
            <div className="card p-5">
              <h3 className="font-bold text-heading mb-3">جدول الأقساط المولّد تلقائياً</h3>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {installmentDates.map((date, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 text-sm border-b border-surface-100 dark:border-surface-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-muted">{formatDate(date)}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(installmentAmount, symbol)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="alert bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-600/30 text-success-800 dark:text-success-300">
              <Info size={16} className="flex-shrink-0" />
              <span className="text-sm font-bold">سيتم سداد كامل القيمة من الخزينة فوراً كعملية نقدية دون أقساط</span>
            </div>
          )}

          {purchaseMethod === 'credit' && (
            <div className="alert bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-600/30 text-primary-800 dark:text-primary-300">
              <Info size={16} className="flex-shrink-0" />
              <span className="text-sm">سيتم إنشاء {installmentCount} قسط تلقائياً عند تأكيد العقد</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1">
            السابق
          </button>
        )}
        {step < 2 ? (
          <button onClick={handleNext} className="btn-primary flex-1">
            التالي
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="btn-success flex-1 btn-lg"
            disabled={createContract.isPending}
          >
            {createContract.isPending ? 'جاري الإنشاء...' : '✓ تأكيد وإنشاء العقد'}
          </button>
        )}
      </div>
    </div>
  )
}
