import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients, useCreateClient, useDeleteClient, useSettings } from '@/hooks/useApi'
import { formatCurrency, calculateContractBalance } from '@/lib/utils'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/States'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/context/ToastContext'
import { Users, Plus, Phone, MapPin, ChevronLeft, Search, Edit, Trash2, User } from 'lucide-react'

export function ClientForm({ initialData = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    name: initialData.name || '',
    phone: initialData.phone || '',
    national_id: initialData.national_id || '',
    address: initialData.address || '',
    notes: initialData.notes || '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="label">الاسم الكامل *</label>
        <input className="input" placeholder="محمد أحمد السيد" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">رقم الهاتف</label>
          <input className="input" placeholder="01xxxxxxxxx" value={form.phone} dir="ltr"
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="label">رقم الهوية</label>
          <input className="input" placeholder="2xxxxxxxxxxxxxx" value={form.national_id} dir="ltr"
            onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} />
        </div>
      </div>
      <div className="form-group">
        <label className="label">العنوان</label>
        <input className="input" placeholder="القاهرة - مدينة نصر..." value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="label">ملاحظات</label>
        <textarea className="input" rows={2} placeholder="أي معلومات إضافية..."
          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
    </form>
  )
}

function ClientCard({ client, symbol }) {
  const activeContracts = client.contracts?.filter(c => c.status === 'active' || c.status === 'late') || []
  const totalBalance = client.contracts?.reduce((sum, c) => {
    const balance = calculateContractBalance(c.installments)
    return sum + balance.remaining
  }, 0) || 0

  const lateCount = client.contracts?.reduce((count, c) => {
    return count + (c.installments?.filter(i => i.status === 'late').length || 0)
  }, 0) || 0

  return (
    <Link to={`/receivables/${client.id}`} className="card-hover p-4 block">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <div className="font-bold text-heading">{client.name}</div>
            {client.phone && (
              <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                <Phone size={11} />
                <span dir="ltr">{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <MapPin size={11} />
                <span className="truncate max-w-[160px]">{client.address}</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-left flex-shrink-0">
          <div className="font-bold text-success-600 dark:text-success-400 text-base">
            {formatCurrency(totalBalance, symbol)}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {activeContracts.length} عقد نشط
          </div>
        </div>
      </div>

      {lateCount > 0 && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-danger-50 dark:bg-danger-600/10 text-xs text-danger-700 dark:text-danger-400 font-medium">
          ⚠️ {lateCount} قسط متأخر
        </div>
      )}

      <div className="flex items-center justify-end mt-3 text-primary-600 dark:text-primary-400">
        <span className="text-xs font-medium">عرض التفاصيل</span>
        <ChevronLeft size={14} />
      </div>
    </Link>
  )
}

export default function Receivables() {
  const { data: clients, isLoading, error, refetch } = useClients()
  const { data: settings } = useSettings()
  const createClient = useCreateClient()
  const deleteClient = useDeleteClient()
  const toast = useToast()

  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  const symbol = settings?.currency_symbol || 'ج.م'

  const filtered = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  ) || []

  const handleCreate = async (data) => {
    try {
      await createClient.mutateAsync(data)
      toast.success('تم إضافة العميل بنجاح')
      setShowAdd(false)
    } catch (err) {
      toast.error(err.message || 'فشل إضافة العميل')
    }
  }

  if (isLoading) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">المديونيات</h1>
          <p className="text-muted text-sm">{clients?.length || 0} عميل مسجل</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={18} />
          <span>إضافة عميل</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          className="input pr-10"
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Clients Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد عملاء"
          description="أضف أول عميل لتبدأ في إدارة المديونيات"
          action={
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={18} />
              إضافة عميل
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => (
            <ClientCard key={client.id} client={client} symbol={symbol} />
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="إضافة عميل جديد"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">إلغاء</button>
            <button
              form="client-form"
              type="submit"
              className="btn-primary flex-1"
              disabled={createClient.isPending}
            >
              {createClient.isPending ? 'جاري الحفظ...' : 'إضافة العميل'}
            </button>
          </div>
        }
      >
        <ClientForm onSubmit={handleCreate} loading={createClient.isPending} />
      </Modal>
    </div>
  )
}
