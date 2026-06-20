import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useClient, useSettings, useUpdateClient, useDeleteClient } from '@/hooks/useApi'
import {
  formatCurrency, formatDate, calculateContractBalance,
  getContractStatusClass, getContractStatusLabel,
  getInstallmentStatusClass, getInstallmentStatusLabel,
  generateWhatsAppMessage
} from '@/lib/utils'
import { PageLoader, ErrorState } from '@/components/ui/States'
import PaymentModal from '@/components/ui/PaymentModal'
import Modal from '@/components/ui/Modal'
import { ClientForm } from '@/pages/Receivables'
import { useToast } from '@/context/ToastContext'
import {
  ArrowRight, Phone, MapPin, CreditCard, User,
  ChevronDown, ChevronUp, MessageCircle, ExternalLink,
  FileText, Calendar, TrendingUp, Plus, Edit, Trash2, Printer, AlertTriangle
} from 'lucide-react'
import { StatementPrintTemplate } from '@/components/ui/PrintTemplates'

function ContractCard({ contract, symbol, onPay, onWhatsApp }) {
  const [expanded, setExpanded] = useState(false)
  const balance = calculateContractBalance(contract.installments)

  const paidCount = contract.installments?.filter(i => i.status === 'paid').length || 0
  const totalCount = contract.installments?.length || 0
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0

  const lateInstallments = contract.installments?.filter(i => i.status === 'late') || []
  const pendingInstallments = contract.installments?.filter(i =>
    i.status === 'pending' || i.status === 'partial' || i.status === 'late'
  ) || []

  return (
    <div className="card overflow-hidden">
      {/* Contract Header */}
      <div
        className="p-4 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="font-bold text-heading text-sm leading-tight">
                {contract.item_description}
              </div>
              <div className="text-xs text-muted mt-0.5">
                من {formatDate(contract.start_date)} · يوم {contract.due_day} من كل شهر
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={getContractStatusClass(contract.status)}>
              {getContractStatusLabel(contract.status)}
            </span>
            {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>{paidCount} / {totalCount} قسط مدفوع</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center">
            <div className="text-xs text-muted">إجمالي</div>
            <div className="font-bold text-sm text-heading">{formatCurrency(contract.total_price, symbol)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted">مدفوع</div>
            <div className="font-bold text-sm text-success-600">{formatCurrency(balance.paid, symbol)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted">متبقي</div>
            <div className="font-bold text-sm text-danger-600">{formatCurrency(balance.remaining, symbol)}</div>
          </div>
        </div>
      </div>

      {/* Expanded Installments Table */}
      {expanded && (
        <div className="border-t border-surface-100 dark:border-surface-700">
          {lateInstallments.length > 0 && (
            <div className="px-4 py-2 bg-danger-50 dark:bg-danger-600/10 text-xs text-danger-700 dark:text-danger-400 font-medium">
              ⚠️ {lateInstallments.length} قسط متأخر
            </div>
          )}
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
                    <td>
                      <span className="font-mono text-xs">{inst.installment_number}</span>
                    </td>
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
                        <div className="flex gap-1">
                          <button
                            onClick={() => onPay({ ...inst, contracts: contract })}
                            className="btn-success btn-sm"
                          >
                            دفع
                          </button>
                          <button
                            onClick={() => onWhatsApp(inst, contract)}
                            className="btn-ghost btn-sm text-green-600 hover:text-green-700"
                            title="تذكير واتساب"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
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

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: client, isLoading, error, refetch } = useClient(id)
  const { data: settings } = useSettings()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()

  const [selectedInstallment, setSelectedInstallment] = useState(null)
  const [whatsappMsg, setWhatsappMsg] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const symbol = settings?.currency_symbol || 'ج.م'

  const handleWhatsApp = (installment, contract) => {
    const msg = generateWhatsAppMessage({
      clientName: client?.name,
      amount: installment.remaining_amount || installment.amount,
      dueDate: installment.due_date,
      businessName: settings?.business_name || 'نظام التقسيط',
      installmentNumber: installment.installment_number,
      totalInstallments: contract.installment_count,
    })
    const phone = client?.phone?.replace(/^0/, '20').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const handleUpdate = async (formData) => {
    try {
      await updateClient.mutateAsync({ id, ...formData })
      toast.success('تم تحديث بيانات العميل بنجاح')
      setShowEdit(false)
      refetch()
    } catch (err) {
      toast.error(err.message || 'فشل تحديث البيانات')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteClient.mutateAsync(id)
      toast.success('تم حذف العميل بنجاح')
      setShowDelete(false)
      navigate('/receivables')
    } catch (err) {
      toast.error(err.message || 'فشل حذف العميل')
    }
  }

  if (isLoading) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!client) return null

  const totalBalance = client.contracts?.reduce((sum, c) => {
    const balance = calculateContractBalance(c.installments)
    return sum + balance.remaining
  }, 0) || 0

  const activeContracts = client.contracts?.filter(c => c.status === 'active' || c.status === 'late') || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/receivables" className="btn-ghost btn-icon">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-heading">{client.name}</h1>
            <p className="text-muted text-sm">سجل العميل والأقساط</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={() => window.print()} className="btn-success">
            <Printer size={16} />
            <span>طباعة كشف الحساب</span>
          </button>
          <button onClick={() => setShowEdit(true)} className="btn-secondary">
            <Edit size={16} />
            <span>تعديل البيانات</span>
          </button>
          <button onClick={() => setShowDelete(true)} className="btn bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/20 dark:border-red-900/30 dark:text-red-400">
            <Trash2 size={16} />
            <span>حذف العميل</span>
          </button>
        </div>
      </div>

      {/* Client Info Card */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-xl font-bold text-heading">{client.name}</h2>
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Phone size={14} />
                <a href={`tel:${client.phone}`} className="hover:text-primary-600" dir="ltr">{client.phone}</a>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <MapPin size={14} />
                <span>{client.address}</span>
              </div>
            )}
            {client.national_id && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <CreditCard size={14} />
                <span dir="ltr">{client.national_id}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">
              {formatCurrency(totalBalance, symbol)}
            </div>
            <div className="text-xs text-muted">إجمالي المديونية</div>
          </div>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-surface-100 dark:border-surface-700">
          <div className="text-center">
            <div className="text-lg font-bold text-heading">{client.contracts?.length || 0}</div>
            <div className="text-xs text-muted">إجمالي العقود</div>
          </div>
          <div className="text-center border-x border-surface-100 dark:border-surface-700">
            <div className="text-lg font-bold text-primary-600">{activeContracts.length}</div>
            <div className="text-xs text-muted">عقود نشطة</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-danger-600">
              {client.contracts?.reduce((c, contract) =>
                c + (contract.installments?.filter(i => i.status === 'late').length || 0), 0) || 0}
            </div>
            <div className="text-xs text-muted">أقساط متأخرة</div>
          </div>
        </div>
      </div>

      {/* Add Contract Link */}
      <Link
        to={`/contracts/new?client=${id}&type=RECEIVABLE`}
        className="card p-4 flex items-center gap-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-2 border-dashed border-primary-300 dark:border-primary-600"
      >
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Plus size={20} className="text-primary-600" />
        </div>
        <span className="font-medium text-primary-700 dark:text-primary-400">إضافة عقد جديد لهذا العميل</span>
      </Link>

      {/* Contracts */}
      <div className="space-y-4">
        <h2 className="font-bold text-heading text-lg">العقود والأقساط</h2>

        {client.contracts?.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-muted">لا توجد عقود لهذا العميل</p>
          </div>
        ) : (
          client.contracts?.map(contract => (
            <ContractCard
              key={contract.id}
              contract={contract}
              symbol={symbol}
              onPay={setSelectedInstallment}
              onWhatsApp={handleWhatsApp}
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

      {/* Edit Client Modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="تعديل بيانات العميل"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setShowEdit(false)} className="btn-secondary flex-1">إلغاء</button>
            <button
              form="client-form"
              type="submit"
              className="btn-primary flex-1"
              disabled={updateClient.isPending}
            >
              {updateClient.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        }
      >
        <ClientForm 
          initialData={{
            name: client.name,
            phone: client.phone || '',
            national_id: client.national_id || '',
            address: client.address || '',
            notes: client.notes || '',
          }} 
          onSubmit={handleUpdate} 
          loading={updateClient.isPending} 
        />
      </Modal>

      {/* Delete Client Modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="حذف العميل"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setShowDelete(false)} className="btn-secondary flex-1">إلغاء</button>
            {(!client.contracts || client.contracts.length === 0) && (
              <button
                onClick={handleDelete}
                className="btn-danger flex-1"
                disabled={deleteClient.isPending}
              >
                {deleteClient.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            )}
          </div>
        }
      >
        {client.contracts && client.contracts.length > 0 ? (
          <div className="space-y-3 py-2">
            <div className="w-12 h-12 rounded-full bg-warning-50 dark:bg-warning-950/20 text-warning-600 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle size={24} />
            </div>
            <p className="text-heading font-bold text-center text-sm">
              لا يمكن حذف هذا العميل!
            </p>
            <p className="text-muted text-xs leading-relaxed text-center">
              العميل <strong className="text-primary-600">"{client.name}"</strong> لديه عقود مسجلة أو تعاملات سابقة في النظام. يرجى تسوية العقود أو مسحها أولاً لتتمكن من حذف العميل.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-heading font-medium">هل أنت متأكد من رغبتك في حذف العميل <strong className="text-primary-600">"{client.name}"</strong>؟</p>
            <p className="text-muted text-sm leading-relaxed">
              سيؤدي هذا الإجراء إلى أرشفة العميل وإخفائه من قائمة المديونيات النشطة.
            </p>
          </div>
        )}
      </Modal>

      <StatementPrintTemplate client={client} symbol={symbol} businessSettings={settings} />
    </div>
  )
}
