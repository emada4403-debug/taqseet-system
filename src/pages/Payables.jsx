import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSuppliers, useCreateSupplier, useSettings } from '@/hooks/useApi'
import { formatCurrency, calculateContractBalance } from '@/lib/utils'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/States'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/context/ToastContext'
import { Store, Plus, Phone, Building2, ChevronLeft, Search } from 'lucide-react'

function SupplierForm({ initialData = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    name: initialData.name || '',
    phone: initialData.phone || '',
    company: initialData.company || '',
    notes: initialData.notes || '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="label">اسم المورد *</label>
        <input className="input" placeholder="أحمد عبدالله" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">رقم الهاتف</label>
          <input className="input" placeholder="01xxxxxxxxx" value={form.phone} dir="ltr"
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="label">اسم الشركة</label>
          <input className="input" placeholder="شركة..." value={form.company}
            onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
        </div>
      </div>
      <div className="form-group">
        <label className="label">ملاحظات</label>
        <textarea className="input" rows={2} placeholder="معلومات إضافية..."
          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
    </form>
  )
}

function SupplierCard({ supplier, symbol }) {
  const totalOwed = supplier.contracts?.reduce((sum, c) => {
    const balance = calculateContractBalance(c.installments)
    return sum + balance.remaining
  }, 0) || 0

  const activeContracts = supplier.contracts?.filter(c => c.status === 'active' || c.status === 'late') || []
  const lateCount = supplier.contracts?.reduce((count, c) =>
    count + (c.installments?.filter(i => i.status === 'late').length || 0), 0) || 0

  return (
    <Link to={`/payables/${supplier.id}`} className="card-hover p-4 block">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-danger-600 dark:text-danger-400" />
          </div>
          <div>
            <div className="font-bold text-heading">{supplier.name}</div>
            {supplier.company && (
              <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                <Building2 size={11} />
                <span>{supplier.company}</span>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <Phone size={11} />
                <span dir="ltr">{supplier.phone}</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-left flex-shrink-0">
          <div className="font-bold text-danger-600 dark:text-danger-400 text-base">
            {formatCurrency(totalOwed, symbol)}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {activeContracts.length} عقد نشط
          </div>
        </div>
      </div>

      {lateCount > 0 && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-danger-50 dark:bg-danger-600/10 text-xs text-danger-700 dark:text-danger-400 font-medium">
          ⚠️ {lateCount} قسط متأخر عليك
        </div>
      )}

      <div className="flex items-center justify-end mt-3 text-primary-600 dark:text-primary-400">
        <span className="text-xs font-medium">عرض التفاصيل</span>
        <ChevronLeft size={14} />
      </div>
    </Link>
  )
}

export default function Payables() {
  const { data: suppliers, isLoading, error, refetch } = useSuppliers()
  const { data: settings } = useSettings()
  const createSupplier = useCreateSupplier()
  const toast = useToast()

  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  const symbol = settings?.currency_symbol || 'ج.م'

  const filtered = suppliers?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.company?.toLowerCase().includes(search.toLowerCase())
  ) || []

  const handleCreate = async (data) => {
    try {
      await createSupplier.mutateAsync(data)
      toast.success('تم إضافة المورد بنجاح')
      setShowAdd(false)
    } catch (err) {
      toast.error(err.message || 'فشل إضافة المورد')
    }
  }

  if (isLoading) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">المستحقات</h1>
          <p className="text-muted text-sm">{suppliers?.length || 0} مورد مسجل</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={18} />
          <span>إضافة مورد</span>
        </button>
      </div>

      <div className="relative">
        <input className="input pr-10" placeholder="بحث بالاسم أو الشركة..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title="لا يوجد موردون"
          description="أضف أول مورد لتبدأ في إدارة المستحقات"
          action={
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={18} />
              إضافة مورد
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(supplier => (
            <SupplierCard key={supplier.id} supplier={supplier} symbol={symbol} />
          ))}
        </div>
      )}

      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="إضافة مورد جديد"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">إلغاء</button>
            <button form="supplier-form" type="submit" className="btn-primary flex-1"
              disabled={createSupplier.isPending}>
              {createSupplier.isPending ? 'جاري الحفظ...' : 'إضافة المورد'}
            </button>
          </div>
        }
      >
        <SupplierForm onSubmit={handleCreate} loading={createSupplier.isPending} />
      </Modal>
    </div>
  )
}
