import { useState } from 'react'
import {
  useDashboard,
  useSettings,
  useClients,
  useSuppliers,
  useExpenses,
  useProducts,
  useContracts
} from '@/hooks/useApi'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader, ErrorState } from '@/components/ui/States'
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  Download, FileSpreadsheet, Wallet, User, Users, Store, Printer, Calendar
} from 'lucide-react'
import * as XLSX from 'xlsx'

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const EXPENSE_CATEGORIES = {
  rent: 'إيجار',
  electricity: 'كهرباء ومياه',
  salaries: 'رواتب وأجور',
  marketing: 'تسويق ودعاية',
  maintenance: 'صيانة وإصلاحات',
  other: 'مصاريف أخرى'
}

const AGING_LABELS = {
  '1-30': '1-30 يوم',
  '31-60': '31-60 يوم',
  '61-90': '61-90 يوم',
  '90+': 'أكثر من 90 يوم',
}

const AGING_COLORS = {
  '1-30': 'border-warning-500 bg-warning-50 dark:bg-warning-600/10',
  '31-60': 'border-orange-500 bg-orange-50 dark:bg-orange-600/10',
  '61-90': 'border-danger-500 bg-danger-50 dark:bg-danger-600/10',
  '90+': 'border-red-700 bg-red-50 dark:bg-red-900/20',
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('profits')
  const { data: settings } = useSettings()
  const symbol = settings?.currency_symbol || 'ج.م'

  // Common Queries
  const { data: clients, isLoading: isClientsLoading, error: clientsErr } = useClients()
  const { data: suppliers, isLoading: isSuppliersLoading, error: suppliersErr } = useSuppliers()
  const { data: products, isLoading: isProductsLoading } = useProducts()
  const { data: allContracts, isLoading: isContractsLoading } = useContracts()
  const { data: expenses, isLoading: isExpensesLoading } = useExpenses()
  
  // Specific hooks for legacy reports
  const today = new Date()
  const [cashflowParams, setCashflowParams] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const { data: cashflowData, isLoading: isCashflowLoading } = useContracts({ type: 'RECEIVABLE' }) // Fetching receivables for cashflow/profit mapping

  // Client Receivables Report states
  const [selectedClientId, setSelectedClientId] = useState('')

  // Safe Report filters
  const [safeDateFrom, setSafeDateFrom] = useState('')
  const [safeDateTo, setSafeDateTo] = useState('')

  if (isClientsLoading || isSuppliersLoading || isProductsLoading || isContractsLoading || isExpensesLoading) {
    return <PageLoader />
  }

  if (clientsErr || suppliersErr) {
    return <ErrorState error={clientsErr || suppliersErr} />
  }

  // --- Calculations for Profits Report ---
  const receivableContracts = allContracts?.filter(c => c.type === 'RECEIVABLE') || []
  let totalSales = 0
  let totalCost = 0
  let totalExpectedProfit = 0
  let totalCollectedProfit = 0

  const profitRows = receivableContracts.map(contract => {
    const total = parseFloat(contract.total_price || 0)
    totalSales += total
    
    // Use manual purchase price and profit from contract
    const cost = parseFloat(contract.purchase_price || 0)
    totalCost += cost

    const expectedProfit = parseFloat(contract.profit || (total - cost))
    totalExpectedProfit += expectedProfit

    // Calculate paid amount
    const totalPaid = contract.installments?.reduce((sum, inst) => {
      const amt = parseFloat(inst.amount || 0)
      const rem = parseFloat(inst.remaining_amount || 0)
      return sum + (amt - rem)
    }, 0) || 0

    // Down payment is also paid
    const dp = parseFloat(contract.down_payment || 0)
    const paidWithDp = totalPaid + dp

    // Collected profit ratio
    const paidRatio = total > 0 ? paidWithDp / total : 0
    const collectedProfit = expectedProfit * paidRatio
    totalCollectedProfit += collectedProfit

    return {
      contract,
      cost,
      expectedProfit,
      paidWithDp,
      collectedProfit
    }
  })

  const totalGeneralExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0
  const netCollectedProfit = totalCollectedProfit - totalGeneralExpenses

  // --- Calculations for Aging Report ---
  const agingBuckets = { '1-30': [], '31-60': [], '61-90': [], '90+': [] }
  receivableContracts.forEach(c => {
    c.installments?.forEach(i => {
      if (i.status === 'late' || (i.status === 'pending' && new Date(i.due_date) < new Date())) {
        const days = Math.floor((new Date() - new Date(i.due_date)) / (1000 * 60 * 60 * 24))
        if (days > 0) {
          const item = { ...i, contracts: c, daysOverdue: days }
          if (days <= 30) agingBuckets['1-30'].push(item)
          else if (days <= 60) agingBuckets['31-60'].push(item)
          else if (days <= 90) agingBuckets['61-90'].push(item)
          else agingBuckets['90+'].push(item)
        }
      }
    })
  })

  // --- Client Receivables calculations ---
  const selectedClient = clients?.find(c => c.id === selectedClientId)
  
  // Excel Export functions
  const handleExportProfitsExcel = () => {
    const rows = [
      ['تاريخ العقد', 'العميل', 'البضاعة', 'قيمة البيع (قسط)', 'قيمة الشراء (التكلفة)', 'الربح المتوقع', 'المسدد الفعلي', 'الربح المحصل الفعلي'],
      ...profitRows.map(r => [
        r.contract.start_date,
        r.contract.clients?.name || 'غير معروف',
        r.contract.item_description,
        parseFloat(r.contract.total_price),
        r.cost,
        r.expectedProfit,
        r.paidWithDp,
        r.collectedProfit
      ]),
      [],
      ['إجمالي المبيعات القسط', totalSales],
      ['إجمالي تكلفة الشراء', totalCost],
      ['إجمالي الأرباح المتوقعة', totalExpectedProfit],
      ['إجمالي الأرباح المحصلة فعلياً', totalCollectedProfit],
      ['إجمالي المصاريف العامة', totalGeneralExpenses],
      ['صافي الأرباح المحصلة', netCollectedProfit]
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الأرباح')
    XLSX.writeFile(wb, 'profits_report.xlsx')
  }

  const handleExportClientReceivablesExcel = () => {
    if (selectedClient) {
      const rows = [
        ['اسم العميل', selectedClient.name],
        ['الهاتف', selectedClient.phone || '-'],
        ['الرقم القومي', selectedClient.national_id || '-'],
        ['العنوان', selectedClient.address || '-'],
        [],
        ['البضاعة', 'تاريخ البدء', 'إجمالي العقد', 'المقدم', 'المسدد', 'المتبقي', 'الحالة'],
        ...(selectedClient.contracts || []).map(c => {
          const totalPaid = c.installments?.reduce((s, i) => s + (parseFloat(i.amount) - parseFloat(i.remaining_amount)), 0) || 0
          const remaining = c.installments?.reduce((s, i) => s + parseFloat(i.remaining_amount), 0) || 0
          return [
            c.item_description,
            c.start_date,
            parseFloat(c.total_price),
            parseFloat(c.down_payment || 0),
            totalPaid + parseFloat(c.down_payment || 0),
            remaining,
            c.status === 'active' ? 'نشط' : c.status === 'completed' ? 'مكتمل' : 'متأخر'
          ]
        })
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `مديونية_${selectedClient.name}`)
      XLSX.writeFile(wb, `client_receivable_${selectedClient.name}.xlsx`)
    } else {
      const rows = [
        ['اسم العميل', 'رقم الهاتف', 'إجمالي العقود', 'المبلغ المسدد', 'المديونية المتبقية'],
        ...clients.map(c => {
          const totalContracts = c.contracts?.reduce((s, co) => s + parseFloat(co.total_price), 0) || 0
          const remaining = c.contracts?.reduce((s, co) => s + (co.installments?.reduce((sum, i) => sum + parseFloat(i.remaining_amount), 0) || 0), 0) || 0
          const paid = totalContracts - remaining
          return [c.name, c.phone || '-', totalContracts, paid, remaining]
        })
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'مديونيات العملاء')
      XLSX.writeFile(wb, 'clients_receivables_general.xlsx')
    }
  }

  const handleExportSuppliersExcel = () => {
    const rows = [
      ['اسم المورد', 'الشركة', 'رقم الهاتف', 'إجمالي المستحقات المشتراة', 'المسدد له', 'المتبقي للمورد'],
      ...suppliers.map(s => {
        const total = s.contracts?.reduce((sum, c) => sum + parseFloat(c.total_price), 0) || 0
        const remaining = s.contracts?.reduce((sum, c) => sum + (c.installments?.reduce((sI, i) => sI + parseFloat(i.remaining_amount), 0) || 0), 0) || 0
        const paid = total - remaining
        return [
          s.name,
          s.company || '-',
          s.phone || '-',
          total,
          paid,
          remaining
        ]
      })
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'مديونيات الموردين')
    XLSX.writeFile(wb, 'suppliers_payables.xlsx')
  }

  const printReport = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-heading">نظام التقارير المتقدم</h1>
          <p className="text-muted text-sm">تحليل مالي مفصل لبيانات الأرباح والمديونيات والخزينة</p>
        </div>
        <div className="flex gap-2">
          <button onClick={printReport} className="btn-success flex items-center gap-1.5">
            <Printer size={16} />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex flex-wrap gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl no-print">
        {[
          { id: 'profits', label: 'تقرير الأرباح والخسائر', icon: BarChart3 },
          { id: 'client_receivables', label: 'مديونيات العملاء', icon: User },
          { id: 'supplier_payables', label: 'مديونيات الموردين', icon: Store },
          { id: 'aging', label: 'تقرير التأخير وأعمار الديون', icon: AlertTriangle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
                : 'text-muted hover:text-heading'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================== */}
      {/* 1. PROFITS REPORT TAB */}
      {/* ========================================== */}
      {activeTab === 'profits' && (
        <div className="space-y-6 no-print">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-heading">تحليل الأرباح التفصيلي</h2>
            <button onClick={handleExportProfitsExcel} className="btn-secondary btn-sm flex items-center gap-1">
              <FileSpreadsheet size={14} />
              <span>تصدير Excel</span>
            </button>
          </div>

          {/* Cards summary */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card p-4">
              <span className="text-xs text-muted block">إجمالي مبيعات التقسيط</span>
              <span className="text-2xl font-bold text-heading block mt-1">{formatCurrency(totalSales, symbol)}</span>
            </div>
            <div className="card p-4">
              <span className="text-xs text-muted block">تكلفة شراء الأجهزة المباعة</span>
              <span className="text-2xl font-bold text-slate-600 block mt-1">{formatCurrency(totalCost, symbol)}</span>
            </div>
            <div className="card p-4">
              <span className="text-xs text-muted block">الأرباح الإجمالية المتوقعة</span>
              <span className="text-2xl font-bold text-primary-600 block mt-1">{formatCurrency(totalExpectedProfit, symbol)}</span>
            </div>
            <div className="card p-4">
              <span className="text-xs text-muted block">الأرباح المحصلة فعلياً</span>
              <span className="text-2xl font-bold text-success-600 block mt-1">{formatCurrency(totalCollectedProfit, symbol)}</span>
            </div>
            <div className="card p-4">
              <span className="text-xs text-muted block">المصروفات العامة والتشغيلية</span>
              <span className="text-2xl font-bold text-danger-600 block mt-1">{formatCurrency(totalGeneralExpenses, symbol)}</span>
            </div>
            <div className="card p-4 bg-gradient-to-br from-primary-500/10 to-transparent border-primary-300">
              <span className="text-xs text-primary-700 dark:text-primary-400 font-bold block">صافي الأرباح المحصلة</span>
              <span className={`text-2xl font-extrabold block mt-1 ${netCollectedProfit >= 0 ? 'text-green-600' : 'text-danger-600'}`}>
                {formatCurrency(netCollectedProfit, symbol)}
              </span>
            </div>
          </div>

          {/* Profits Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-surface-200 dark:border-surface-700">
              <h3 className="font-bold text-heading text-sm">تفصيل أرباح العقود النشطة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-right text-xs">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800">
                    <th className="p-3">العقد / السلعة</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">سعر البيع</th>
                    <th className="p-3">سعر الشراء</th>
                    <th className="p-3">الربح المتوقع</th>
                    <th className="p-3">المحصل فعلياً</th>
                    <th className="p-3">نسبة السداد</th>
                    <th className="p-3">الربح المحصل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {profitRows.map(({ contract, cost, expectedProfit, paidWithDp, collectedProfit }) => {
                    const ratio = contract.total_price > 0 ? (paidWithDp / contract.total_price) * 100 : 0
                    return (
                      <tr key={contract.id} className="hover:bg-surface-50/50">
                        <td className="p-3 font-semibold text-heading">{contract.item_description}</td>
                        <td className="p-3 text-muted">{contract.clients?.name}</td>
                        <td className="p-3 font-medium">{formatCurrency(contract.total_price, symbol)}</td>
                        <td className="p-3 text-slate-500">{cost > 0 ? formatCurrency(cost, symbol) : 'إدخال يدوي / -'}</td>
                        <td className="p-3 font-medium text-primary-600">{formatCurrency(expectedProfit, symbol)}</td>
                        <td className="p-3 text-success-600">{formatCurrency(paidWithDp, symbol)}</td>
                        <td className="p-3 font-mono text-[10px]">{ratio.toFixed(0)}%</td>
                        <td className="p-3 font-bold text-success-700">{formatCurrency(collectedProfit, symbol)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. CLIENT RECEIVABLES TAB */}
      {/* ========================================== */}
      {activeTab === 'client_receivables' && (
        <div className="space-y-6 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-heading whitespace-nowrap">اختر العميل:</span>
              <select
                className="input text-xs"
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
              >
                <option value="">-- كل العملاء --</option>
                {clients?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button onClick={handleExportClientReceivablesExcel} className="btn-secondary btn-sm flex items-center gap-1">
              <FileSpreadsheet size={14} />
              <span>تصدير Excel</span>
            </button>
          </div>

          {selectedClient ? (
            <div className="space-y-6">
              {/* Individual client details */}
              <div className="card p-5 grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div><span className="text-muted">العميل:</span> <strong className="text-heading text-sm">{selectedClient.name}</strong></div>
                  <div><span className="text-muted">الهاتف:</span> <span dir="ltr">{selectedClient.phone || '-'}</span></div>
                </div>
                <div className="space-y-2 text-left">
                  <div><span className="text-muted">الرقم القومي:</span> <span>{selectedClient.national_id || '-'}</span></div>
                  <div><span className="text-muted">العنوان:</span> <span>{selectedClient.address || '-'}</span></div>
                </div>
              </div>

              {/* Client contracts */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-surface-200 dark:border-surface-700">
                  <h3 className="font-bold text-heading text-sm">عقود وأقساط العميل</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="table text-right text-xs">
                    <thead>
                      <tr className="bg-surface-50 dark:bg-surface-800">
                        <th className="p-3">تاريخ العقد</th>
                        <th className="p-3">السلعة</th>
                        <th className="p-3">السعر الإجمالي</th>
                        <th className="p-3">المقدم</th>
                        <th className="p-3">المسدد</th>
                        <th className="p-3">المتبقي</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                      {selectedClient.contracts?.map(c => {
                        const totalPaid = c.installments?.reduce((s, i) => s + (parseFloat(i.amount) - parseFloat(i.remaining_amount)), 0) || 0
                        const remaining = c.installments?.reduce((s, i) => s + parseFloat(i.remaining_amount), 0) || 0
                        return (
                          <tr key={c.id}>
                            <td className="p-3">{formatDate(c.start_date)}</td>
                            <td className="p-3 font-semibold">{c.item_description}</td>
                            <td className="p-3">{formatCurrency(c.total_price, symbol)}</td>
                            <td className="p-3">{formatCurrency(c.down_payment || 0, symbol)}</td>
                            <td className="p-3 text-success-600">{formatCurrency(totalPaid + parseFloat(c.down_payment || 0), symbol)}</td>
                            <td className="p-3 font-bold text-danger-600">{formatCurrency(remaining, symbol)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                c.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {c.status === 'active' ? 'نشط' : 'منتهي'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* General Client summary table */
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table text-right text-xs">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-800">
                      <th className="p-3">اسم العميل</th>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">إجمالي القيمة المتعاقد عليها</th>
                      <th className="p-3">المبلغ المسدد</th>
                      <th className="p-3">المديونية المتبقية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {clients?.map(c => {
                      const totalContractsVal = c.contracts?.reduce((s, co) => s + parseFloat(co.total_price), 0) || 0
                      const remaining = c.contracts?.reduce((s, co) => s + (co.installments?.reduce((sum, i) => sum + parseFloat(i.remaining_amount), 0) || 0), 0) || 0
                      const paid = totalContractsVal - remaining
                      return (
                        <tr key={c.id} className="hover:bg-surface-50/50">
                          <td className="p-3 font-semibold text-heading">{c.name}</td>
                          <td className="p-3 text-muted">{c.phone || '-'}</td>
                          <td className="p-3">{formatCurrency(totalContractsVal, symbol)}</td>
                          <td className="p-3 text-success-600">{formatCurrency(paid, symbol)}</td>
                          <td className="p-3 font-bold text-danger-600">{formatCurrency(remaining, symbol)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 3. SUPPLIER PAYABLES TAB */}
      {/* ========================================== */}
      {activeTab === 'supplier_payables' && (
        <div className="space-y-6 no-print">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-heading">مستحقات الموردين</h2>
            <button onClick={handleExportSuppliersExcel} className="btn-secondary btn-sm flex items-center gap-1">
              <FileSpreadsheet size={14} />
              <span>تصدير Excel</span>
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table text-right text-xs">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800">
                    <th className="p-3">اسم المورد</th>
                    <th className="p-3">الشركة</th>
                    <th className="p-3">الهاتف</th>
                    <th className="p-3">إجمالي المستحقات</th>
                    <th className="p-3">المبلغ المسدد له</th>
                    <th className="p-3">المتبقي له</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {suppliers?.map(s => {
                    const totalVal = s.contracts?.reduce((sum, c) => sum + parseFloat(c.total_price), 0) || 0
                    const remaining = s.contracts?.reduce((sum, c) => sum + (c.installments?.reduce((sI, i) => sI + parseFloat(i.remaining_amount), 0) || 0), 0) || 0
                    const paid = totalVal - remaining
                    return (
                      <tr key={s.id} className="hover:bg-surface-50/50">
                        <td className="p-3 font-semibold text-heading">{s.name}</td>
                        <td className="p-3 text-muted">{s.company || '-'}</td>
                        <td className="p-3 font-mono">{s.phone || '-'}</td>
                        <td className="p-3">{formatCurrency(totalVal, symbol)}</td>
                        <td className="p-3 text-success-600">{formatCurrency(paid, symbol)}</td>
                        <td className="p-3 font-bold text-danger-600">{formatCurrency(remaining, symbol)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* ========================================== */}
      {/* 5. AGING (LATE DEBTS) TAB */}
      {/* ========================================== */}
      {activeTab === 'aging' && (
        <div className="space-y-4 no-print">
          {Object.entries(agingBuckets).map(([bucket, items]) => (
            <div key={bucket} className={`card border-r-4 ${AGING_COLORS[bucket]} overflow-hidden`}>
              <div className="p-4 border-b border-surface-100 dark:border-surface-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-danger-600" />
                    <span className="font-bold text-heading">{AGING_LABELS[bucket]}</span>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-danger-600 text-sm">
                      {formatCurrency(items.reduce((s, i) => s + parseFloat(i.remaining_amount), 0), symbol)}
                    </span>
                    <span className="text-xs text-muted mr-2">({items.length} قسط متأخر)</span>
                  </div>
                </div>
              </div>

              {items.length > 0 ? (
                <div className="divide-y divide-surface-100 dark:divide-surface-700 text-xs">
                  {items.map(inst => (
                    <div key={inst.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-heading">
                          {inst.contracts?.clients?.name}
                        </div>
                        <div className="text-xs text-muted">{inst.contracts?.item_description}</div>
                        <div className="text-xs text-danger-600 mt-0.5">متأخر {inst.daysOverdue} يوم</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{formatCurrency(inst.remaining_amount, symbol)}</div>
                        <div className="text-xs text-muted">{formatDate(inst.due_date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted text-sm">لا توجد أقساط متأخرة في هذا النطاق ✓</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ================================================================================================= */}
      {/* PRINT-ONLY SECTIONS (HIDDEN ON SCREEN, DISPLAYED ON window.print() ACCORDING TO THE ACTIVE TAB) */}
      {/* ================================================================================================= */}
      <div className="print-only w-full bg-white text-slate-800 p-8 space-y-6 dir-rtl text-right">
        {/* Letterhead */}
        <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{settings?.business_name || 'نظام التقسيط المحاسبي'}</h1>
            <p className="text-xs text-slate-500 mt-1">تقارير محاسبية تفصيلية للمبيعات والمدفوعات</p>
          </div>
          <div className="text-left text-xs text-slate-500">
            <p>التاريخ: {formatDate(new Date().toISOString().split('T')[0])}</p>
            <p>نوع التقرير: {{
              profits: 'تقرير الأرباح والخسائر وتحليل العقود',
              client_receivables: 'كشف مديونية وتفاصيل العميل',
              supplier_payables: 'تقرير مستحقات الديون للموردين',
              aging: 'تقرير أعمار الديون والأقساط المتأخرة'
            }[activeTab]}</p>
          </div>
        </div>

        {/* 1. Print Profits */}
        {activeTab === 'profits' && (
          <div className="space-y-6">
            <h2 className="text-center text-lg font-bold py-2 bg-slate-100 rounded-lg">بيان الأرباح والخسائر السنوي والشهري</h2>
            
            <table className="w-full text-xs text-right border-collapse border border-slate-200">
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="p-3 font-semibold">إجمالي المبيعات (قسط):</td>
                  <td className="p-3 font-bold text-left">{formatCurrency(totalSales, symbol)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-3 font-semibold">تكلفة الشراء (COGS):</td>
                  <td className="p-3 font-bold text-left">{formatCurrency(totalCost, symbol)}</td>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="p-3 font-semibold">الأرباح المتوقعة الكلية:</td>
                  <td className="p-3 font-bold text-primary-700 text-left">{formatCurrency(totalExpectedProfit, symbol)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-3 font-semibold">الأرباح المحصلة فعلياً:</td>
                  <td className="p-3 font-bold text-green-700 text-left">{formatCurrency(totalCollectedProfit, symbol)}</td>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="p-3 font-semibold">المصروفات والعمولات التشغيلية:</td>
                  <td className="p-3 font-bold text-red-700 text-left">{formatCurrency(totalGeneralExpenses, symbol)}</td>
                </tr>
                <tr className="border-b-2 border-slate-400 font-bold bg-slate-100">
                  <td className="p-3 text-sm">صافي الأرباح المحصلة (Net Income):</td>
                  <td className={`p-3 text-sm text-left ${netCollectedProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(netCollectedProfit, symbol)}
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-bold text-xs mt-6">كشف أرباح مبيعات العقود</h3>
            <table className="w-full text-[10px] text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 border border-slate-200">العقد</th>
                  <th className="p-2 border border-slate-200">العميل</th>
                  <th className="p-2 border border-slate-200">سعر البيع</th>
                  <th className="p-2 border border-slate-200">سعر الشراء</th>
                  <th className="p-2 border border-slate-200">الربح المتوقع</th>
                  <th className="p-2 border border-slate-200">المحصل فعلياً</th>
                  <th className="p-2 border border-slate-200">الربح المحصل</th>
                </tr>
              </thead>
              <tbody>
                {profitRows.map(({ contract, cost, expectedProfit, paidWithDp, collectedProfit }) => (
                  <tr key={contract.id} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-200">{contract.item_description}</td>
                    <td className="p-2 border border-slate-200">{contract.clients?.name}</td>
                    <td className="p-2 border border-slate-200">{formatCurrency(contract.total_price, symbol)}</td>
                    <td className="p-2 border border-slate-200">{cost > 0 ? formatCurrency(cost, symbol) : '-'}</td>
                    <td className="p-2 border border-slate-200">{formatCurrency(expectedProfit, symbol)}</td>
                    <td className="p-2 border border-slate-200">{formatCurrency(paidWithDp, symbol)}</td>
                    <td className="p-2 border border-slate-200 font-bold">{formatCurrency(collectedProfit, symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Print Client Receivables */}
        {activeTab === 'client_receivables' && (
          <div className="space-y-6">
            {selectedClient ? (
              <>
                <h2 className="text-center text-lg font-bold py-2 bg-slate-100 rounded-lg">تقرير مديونية العميل المفصل</h2>
                
                <div className="grid grid-cols-2 gap-4 text-xs p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="mb-1"><strong>اسم العميل:</strong> {selectedClient.name}</p>
                    <p><strong>رقم الهاتف:</strong> {selectedClient.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="mb-1"><strong>الرقم القومي:</strong> {selectedClient.national_id || '-'}</p>
                    <p><strong>العنوان:</strong> {selectedClient.address || '-'}</p>
                  </div>
                </div>

                <h3 className="font-bold text-xs mt-6">عقود العميل الحالية والمديونيات</h3>
                <table className="w-full text-xs text-right border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 border border-slate-200">تاريخ العقد</th>
                      <th className="p-2 border border-slate-200">السلعة</th>
                      <th className="p-2 border border-slate-200">إجمالي السعر</th>
                      <th className="p-2 border border-slate-200">المقدم</th>
                      <th className="p-2 border border-slate-200">المسدد</th>
                      <th className="p-2 border border-slate-200">المديونية المتبقية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClient.contracts?.map(c => {
                      const totalPaid = c.installments?.reduce((s, i) => s + (parseFloat(i.amount) - parseFloat(i.remaining_amount)), 0) || 0
                      const remaining = c.installments?.reduce((s, i) => s + parseFloat(i.remaining_amount), 0) || 0
                      return (
                        <tr key={c.id} className="border-b border-slate-200">
                          <td className="p-2 border border-slate-200">{formatDate(c.start_date)}</td>
                          <td className="p-2 border border-slate-200 font-bold">{c.item_description}</td>
                          <td className="p-2 border border-slate-200">{formatCurrency(c.total_price, symbol)}</td>
                          <td className="p-2 border border-slate-200">{formatCurrency(c.down_payment || 0, symbol)}</td>
                          <td className="p-2 border border-slate-200">{formatCurrency(totalPaid + parseFloat(c.down_payment || 0), symbol)}</td>
                          <td className="p-2 border border-slate-200 font-bold text-red-700">{formatCurrency(remaining, symbol)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <h2 className="text-center text-lg font-bold py-2 bg-slate-100 rounded-lg">كشف مديونيات العملاء العام</h2>
                <table className="w-full text-xs text-right border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 border border-slate-200">العميل</th>
                      <th className="p-2 border border-slate-200">الهاتف</th>
                      <th className="p-2 border border-slate-200">إجمالي المبيعات</th>
                      <th className="p-2 border border-slate-200">المبلغ المسدد</th>
                      <th className="p-2 border border-slate-200">المديونية المتبقية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients?.map(c => {
                      const totalContractsVal = c.contracts?.reduce((s, co) => s + parseFloat(co.total_price), 0) || 0
                      const remaining = c.contracts?.reduce((s, co) => s + (co.installments?.reduce((sum, i) => sum + parseFloat(i.remaining_amount), 0) || 0), 0) || 0
                      const paid = totalContractsVal - remaining
                      return (
                        <tr key={c.id} className="border-b border-slate-200">
                          <td className="p-2 border border-slate-200 font-bold">{c.name}</td>
                          <td className="p-2 border border-slate-200">{c.phone || '-'}</td>
                          <td className="p-2 border border-slate-200">{formatCurrency(totalContractsVal, symbol)}</td>
                          <td className="p-2 border border-slate-200">{formatCurrency(paid, symbol)}</td>
                          <td className="p-2 border border-slate-200 font-bold text-red-700">{formatCurrency(remaining, symbol)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* 3. Print Supplier Payables */}
        {activeTab === 'supplier_payables' && (
          <div className="space-y-6">
            <h2 className="text-center text-lg font-bold py-2 bg-slate-100 rounded-lg">تقرير مستحقات الديون للموردين</h2>
            
            <table className="w-full text-xs text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 border border-slate-200">المورد</th>
                  <th className="p-2 border border-slate-200">الشركة</th>
                  <th className="p-2 border border-slate-200">إجمالي الديون</th>
                  <th className="p-2 border border-slate-200">المسدد للمورد</th>
                  <th className="p-2 border border-slate-200">المتبقي له</th>
                </tr>
              </thead>
              <tbody>
                {suppliers?.map(s => {
                  const totalVal = s.contracts?.reduce((sum, c) => sum + parseFloat(c.total_price), 0) || 0
                  const remaining = s.contracts?.reduce((sum, c) => sum + (c.installments?.reduce((sI, i) => sI + parseFloat(i.remaining_amount), 0) || 0), 0) || 0
                  const paid = totalVal - remaining
                  return (
                    <tr key={s.id} className="border-b border-slate-200">
                      <td className="p-2 border border-slate-200 font-bold">{s.name}</td>
                      <td className="p-2 border border-slate-200">{s.company || '-'}</td>
                      <td className="p-2 border border-slate-200">{formatCurrency(totalVal, symbol)}</td>
                      <td className="p-2 border border-slate-200">{formatCurrency(paid, symbol)}</td>
                      <td className="p-2 border border-slate-200 font-bold text-red-700">{formatCurrency(remaining, symbol)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}



        {/* 5. Print Aging */}
        {activeTab === 'aging' && (
          <div className="space-y-6">
            <h2 className="text-center text-lg font-bold py-2 bg-slate-100 rounded-lg">تقرير أعمار الديون والأقساط المتأخرة</h2>
            {Object.entries(agingBuckets).map(([bucket, items]) => (
              <div key={bucket} className="space-y-2 border border-slate-200 p-3 rounded-lg">
                <h3 className="font-bold text-xs bg-slate-100 p-2 rounded">{AGING_LABELS[bucket]} (إجمالي: {formatCurrency(items.reduce((s, i) => s + parseFloat(i.remaining_amount), 0), symbol)})</h3>
                <table className="w-full text-[10px] text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="p-1">العميل</th>
                      <th className="p-1">البضاعة</th>
                      <th className="p-1">تاريخ الاستحقاق</th>
                      <th className="p-1">المبلغ المتأخر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(inst => (
                      <tr key={inst.id} className="border-b border-slate-100">
                        <td className="p-1 font-semibold">{inst.contracts?.clients?.name}</td>
                        <td className="p-1">{inst.contracts?.item_description}</td>
                        <td className="p-1">{formatDate(inst.due_date)}</td>
                        <td className="p-1 font-bold text-red-700">{formatCurrency(inst.remaining_amount, symbol)}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center p-2 text-slate-400">لا توجد أقساط متأخرة في هذا النطاق</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Print Signatures */}
        <div className="pt-10 grid grid-cols-2 gap-4 text-center text-xs border-t border-dashed border-slate-300">
          <div>
            <p className="text-slate-400 mb-12">توقيع محاسب المحل</p>
            <p className="font-bold border-t border-slate-300 pt-2">{settings?.owner_name || 'صاحب المحل'}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-12">الختم والمصادقة</p>
            <p className="font-bold border-t border-slate-300 pt-2">{settings?.business_name || 'محل التقسيط'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
