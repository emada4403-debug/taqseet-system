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

function getPresetDates(preset) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  let fromDate = new Date()
  let toDate = new Date()

  if (preset === 'this_month') {
    fromDate = new Date(year, month, 1)
    toDate = new Date(year, month + 1, 0)
  } else if (preset === 'last_month') {
    fromDate = new Date(year, month - 1, 1)
    toDate = new Date(year, month, 0)
  } else if (preset === 'this_quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3
    fromDate = new Date(year, quarterStartMonth, 1)
    toDate = new Date(year, quarterStartMonth + 3, 0)
  } else if (preset === 'this_year') {
    fromDate = new Date(year, 0, 1)
    toDate = new Date(year, 11, 31)
  } else {
    fromDate = new Date(2020, 0, 1)
    toDate = new Date(2035, 11, 31)
  }

  const format = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const r = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${r}`
  }
  return { from: format(fromDate), to: format(toDate) }
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('profits')
  const { data: settings } = useSettings()
  const symbol = settings?.currency_symbol || 'ج.م'

  // P&L Period & Accounting Basis States
  const [pnlPreset, setPnlPreset] = useState('this_month')
  const [accountingBasis, setAccountingBasis] = useState('accrual')
  const [pnlDateFrom, setPnlDateFrom] = useState(() => getPresetDates('this_month').from)
  const [pnlDateTo, setPnlDateTo] = useState(() => getPresetDates('this_month').to)

  const handlePresetChange = (preset) => {
    setPnlPreset(preset)
    if (preset !== 'custom') {
      const dates = getPresetDates(preset)
      setPnlDateFrom(dates.from)
      setPnlDateTo(dates.to)
    }
  }

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

  // Helper to check if a date is within the selected period
  const isWithinPeriod = (dateStr) => {
    if (!dateStr) return false
    return dateStr >= pnlDateFrom && dateStr <= pnlDateTo
  }

  // --- Expenses for the Selected Period ---
  const periodExpenses = expenses?.filter(e => isWithinPeriod(e.expense_date)) || []
  const totalGeneralExpenses = periodExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0

  const categorySums = { rent: 0, electricity: 0, salaries: 0, marketing: 0, maintenance: 0, other: 0 }
  periodExpenses.forEach(e => {
    const cat = e.category || 'other'
    if (categorySums[cat] !== undefined) {
      categorySums[cat] += parseFloat(e.amount || 0)
    } else {
      categorySums.other += parseFloat(e.amount || 0)
    }
  })

  // --- Accrual Basis P&L Calculations ---
  const periodContracts = allContracts?.filter(c => isWithinPeriod(c.start_date)) || []
  const receivablePeriodContracts = periodContracts.filter(c => c.type === 'RECEIVABLE')

  let accrualRevenueInstallment = 0
  let accrualRevenueCash = 0
  let accrualCogsInstallment = 0
  let accrualCogsCash = 0

  receivablePeriodContracts.forEach(c => {
    const isCash = c.installment_count === 0
    const total = parseFloat(c.total_price || 0)
    const cost = parseFloat(c.purchase_price || 0)

    if (isCash) {
      accrualRevenueCash += total
      accrualCogsCash += cost
    } else {
      accrualRevenueInstallment += total
      accrualCogsInstallment += cost
    }
  })

  const accrualRevenueTotal = accrualRevenueInstallment + accrualRevenueCash
  const accrualCogsTotal = accrualCogsInstallment + accrualCogsCash
  const accrualGrossProfit = accrualRevenueTotal - accrualCogsTotal
  const accrualNetProfit = accrualGrossProfit - totalGeneralExpenses

  // --- Cash Basis P&L Calculations ---
  // 1. Cash Revenue Collected in the Period
  // Down payments received in the period
  const cashRevenueDownPayments = allContracts?.filter(c => c.type === 'RECEIVABLE' && isWithinPeriod(c.start_date))
    .reduce((sum, c) => sum + parseFloat(c.down_payment || 0), 0) || 0

  // Installment payments received in the period
  let cashRevenueInstallmentPayments = 0
  allContracts?.forEach(c => {
    if (c.type === 'RECEIVABLE') {
      c.installments?.forEach(inst => {
        inst.payments?.forEach(pay => {
          if (isWithinPeriod(pay.payment_date)) {
            cashRevenueInstallmentPayments += parseFloat(pay.amount || 0)
          }
        })
      })
    }
  })

  const cashRevenueTotal = cashRevenueDownPayments + cashRevenueInstallmentPayments

  // 2. Cash Cost (COGS) Paid in the Period (to suppliers)
  // Down payments paid to suppliers in the period
  const cashCogsDownPayments = allContracts?.filter(c => c.type === 'PAYABLE' && isWithinPeriod(c.start_date))
    .reduce((sum, c) => sum + parseFloat(c.down_payment || 0), 0) || 0

  // Installment payments paid to suppliers in the period
  let cashCogsInstallmentPayments = 0
  allContracts?.forEach(c => {
    if (c.type === 'PAYABLE') {
      c.installments?.forEach(inst => {
        inst.payments?.forEach(pay => {
          if (isWithinPeriod(pay.payment_date)) {
            cashCogsInstallmentPayments += parseFloat(pay.amount || 0)
          }
        })
      })
    }
  })

  const cashCogsTotal = cashCogsDownPayments + cashCogsInstallmentPayments
  const cashGrossProfit = cashRevenueTotal - cashCogsTotal
  const cashNetProfit = cashGrossProfit - totalGeneralExpenses

  // --- Profit Rows for Table (Accrual details of contracts in period) ---
  const profitRows = receivablePeriodContracts.map(contract => {
    const total = parseFloat(contract.total_price || 0)
    const cost = parseFloat(contract.purchase_price || 0)
    const expectedProfit = parseFloat(contract.profit || (total - cost))

    // Calculate paid amount
    const totalPaid = contract.installments?.reduce((sum, inst) => {
      const amt = parseFloat(inst.amount || 0)
      const rem = parseFloat(inst.remaining_amount || 0)
      return sum + (amt - rem)
    }, 0) || 0

    const dp = parseFloat(contract.down_payment || 0)
    const paidWithDp = totalPaid + dp

    // Collected profit ratio
    const paidRatio = total > 0 ? paidWithDp / total : 0
    const collectedProfit = expectedProfit * paidRatio

    return {
      contract,
      cost,
      expectedProfit,
      paidWithDp,
      collectedProfit
    }
  })

  // Final summary stats based on active accounting basis
  const displayRevenue = accountingBasis === 'accrual' ? accrualRevenueTotal : cashRevenueTotal
  const displayCOGS = accountingBasis === 'accrual' ? accrualCogsTotal : cashCogsTotal
  const displayGrossProfit = accountingBasis === 'accrual' ? accrualGrossProfit : cashGrossProfit
  const displayNetProfit = accountingBasis === 'accrual' ? accrualNetProfit : cashNetProfit

  // Margins
  const grossMarginPct = displayRevenue > 0 ? (displayGrossProfit / displayRevenue) * 100 : 0
  const netMarginPct = displayRevenue > 0 ? (displayNetProfit / displayRevenue) * 100 : 0
  const opexRatioPct = displayRevenue > 0 ? (totalGeneralExpenses / displayRevenue) * 100 : 0

  const receivableContracts = allContracts?.filter(c => c.type === 'RECEIVABLE') || []

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
      ['بيان الأرباح والخسائر (قائمة الدخل) - ' + (accountingBasis === 'accrual' ? 'أساس الاستحقاق' : 'الأساس النقدي')],
      ['الفترة الزمنية', `${pnlDateFrom} إلى ${pnlDateTo}`],
      [],
      ['البند المحاسبي', 'القيمة بالعملة (' + symbol + ')'],
      ['الإيرادات التشغيلية (Revenue)'],
      ['  مبيعات التقسيط', accountingBasis === 'accrual' ? accrualRevenueInstallment : cashRevenueInstallmentPayments],
      ['  المبيعات النقدية', accountingBasis === 'accrual' ? accrualRevenueCash : cashRevenueDownPayments],
      ['إجمالي الإيرادات', displayRevenue],
      [],
      ['تكلفة المبيعات (Cost of Goods Sold - COGS)'],
      ['  تكلفة أجهزة التقسيط', accountingBasis === 'accrual' ? accrualCogsInstallment : cashCogsInstallmentPayments],
      ['  تكلفة أجهزة الكاش', accountingBasis === 'accrual' ? accrualCogsCash : cashCogsDownPayments],
      ['إجمالي تكلفة المبيعات', displayCOGS],
      [],
      ['مجمل الربح (Gross Profit)', displayGrossProfit],
      ['هامش مجمل الربح (%)', grossMarginPct.toFixed(1) + '%'],
      [],
      ['المصروفات التشغيلية والعمومية (Operating Expenses - OPEX)'],
      ['  إيجار', categorySums.rent],
      ['  كهرباء ومياه', categorySums.electricity],
      ['  رواتب وأجور', categorySums.salaries],
      ['  تسويق ودعاية', categorySums.marketing],
      ['  صيانة وإصلاحات', categorySums.maintenance],
      ['  مصاريف أخرى', categorySums.other],
      ['إجمالي المصروفات التشغيلية', totalGeneralExpenses],
      [],
      ['صافي الأرباح المحصلة (Net Profit)', displayNetProfit],
      ['هامش صافي الربح (%)', netMarginPct.toFixed(1) + '%'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'قائمة الدخل')
    XLSX.writeFile(wb, 'profits_losses_report.xlsx')
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

  const handleExportExpensesExcel = () => {
    const rows = [
      ['تاريخ المصروف', 'عنوان المصروف', 'الفئة', 'الملاحظات', 'المبلغ'],
      ...expenses.map(e => [
        formatDate(e.expense_date),
        e.title,
        EXPENSE_CATEGORIES[e.category] || e.category || 'أخرى',
        e.notes || '-',
        parseFloat(e.amount || 0)
      ]),
      [],
      ['إجمالي المصاريف العامة', totalGeneralExpenses]
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير المصاريف')
    XLSX.writeFile(wb, 'expenses_report.xlsx')
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
          { id: 'expenses', label: 'تحليل المصاريف العامة', icon: Wallet },
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
            <h2 className="text-lg font-bold text-heading">تحليل الأرباح والخسائر (قائمة الدخل)</h2>
            <button onClick={handleExportProfitsExcel} className="btn-secondary btn-sm flex items-center gap-1">
              <FileSpreadsheet size={14} />
              <span>تصدير Excel</span>
            </button>
          </div>

          {/* Period controls & Basis Selector */}
          <div className="card p-5 grid sm:grid-cols-2 gap-4 border border-surface-200 dark:border-surface-700 shadow-sm">
            {/* Period selector */}
            <div className="space-y-3">
              <h3 className="font-bold text-heading text-xs">الفترة الزمنية للتقرير</h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'this_month', label: 'هذا الشهر' },
                  { id: 'last_month', label: 'الشهر السابق' },
                  { id: 'this_quarter', label: 'الربع الحالي' },
                  { id: 'this_year', label: 'العام الحالي' },
                  { id: 'all', label: 'الكل' },
                ].map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetChange(preset.id)}
                    className={`py-1 px-3 rounded-lg text-[10px] font-bold border transition-all ${
                      pnlPreset === preset.id
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'border-surface-200 dark:border-surface-700 text-muted hover:border-primary-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-muted block mb-1">من تاريخ</label>
                  <input
                    type="date"
                    className="input text-xs py-1.5"
                    value={pnlDateFrom}
                    onChange={e => {
                      setPnlDateFrom(e.target.value)
                      setPnlPreset('custom')
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    className="input text-xs py-1.5"
                    value={pnlDateTo}
                    onChange={e => {
                      setPnlDateTo(e.target.value)
                      setPnlPreset('custom')
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Accounting Basis Selection */}
            <div className="space-y-3 sm:border-r sm:border-surface-150 dark:sm:border-surface-700 sm:pr-4">
              <h3 className="font-bold text-heading text-xs">طريقة احتساب الإيرادات (الأساس المحاسبي)</h3>
              <div className="grid grid-cols-2 gap-2 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
                <button
                  onClick={() => setAccountingBasis('accrual')}
                  className={`py-2 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    accountingBasis === 'accrual'
                      ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
                      : 'text-muted hover:text-heading'
                  }`}
                >
                  أساس الاستحقاق (أرباح العقود كاملة)
                </button>
                <button
                  onClick={() => setAccountingBasis('cash')}
                  className={`py-2 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    accountingBasis === 'cash'
                      ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
                      : 'text-muted hover:text-heading'
                  }`}
                >
                  الأساس النقدي (الأرباح المحصلة فعلياً)
                </button>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
                {accountingBasis === 'accrual'
                  ? '• أساس الاستحقاق: يسجل إجمالي قيمة الفواتير والتكاليف كاملة فور إبرام العقد في الفترة المحددة.'
                  : '• الأساس النقدي: يسجل التدفقات النقدية الفعلية فقط (المقدمات + الأقساط المحصلة) مطروحاً منها التكاليف النقدية المدفوعة.'
                }
              </p>
            </div>
          </div>

          {/* Margins & KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 border-r-4 border-primary-500">
              <span className="text-xs text-muted block">هامش مجمل الربح (Gross Margin)</span>
              <span className="text-xl font-extrabold text-heading block mt-1">{grossMarginPct.toFixed(1)}%</span>
            </div>
            <div className="card p-4 border-r-4 border-danger-500">
              <span className="text-xs text-muted block">نسبة المصاريف التشغيلية (OPEX Ratio)</span>
              <span className="text-xl font-extrabold text-danger-600 block mt-1">{opexRatioPct.toFixed(1)}%</span>
            </div>
            <div className="card p-4 border-r-4 border-success-500">
              <span className="text-xs text-muted block">صافي هامش الربح (Net Margin)</span>
              <span className={`text-xl font-extrabold block mt-1 ${displayNetProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {netMarginPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Structured corporate P&L Statement */}
          <div className="card p-6 space-y-4 shadow-sm border border-surface-200 dark:border-surface-700">
            <h3 className="font-extrabold text-heading text-base text-center bg-surface-50 dark:bg-surface-800/40 py-2 rounded-xl border border-surface-200/50">
              بيان الأرباح والخسائر (قائمة الدخل)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse">
                <tbody>
                  {/* Category 1: Revenue */}
                  <tr className="border-b border-surface-200 dark:border-surface-700 font-bold bg-surface-50/50">
                    <td className="py-2.5 px-3 text-heading text-base" colSpan="2">أولاً: الإيرادات التشغيلية (Revenue)</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-750">
                    <td className="py-2 px-6 text-muted">إيرادات المبيعات بالتقسيط (أقساط الفترة)</td>
                    <td className="py-2 px-3 font-mono font-medium text-left">
                      {formatCurrency(accountingBasis === 'accrual' ? accrualRevenueInstallment : cashRevenueInstallmentPayments, symbol)}
                    </td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-750">
                    <td className="py-2 px-6 text-muted">إيرادات المبيعات النقدية (مقدمات كاش)</td>
                    <td className="py-2 px-3 font-mono font-medium text-left">
                      {formatCurrency(accountingBasis === 'accrual' ? accrualRevenueCash : cashRevenueDownPayments, symbol)}
                    </td>
                  </tr>
                  <tr className="border-b border-surface-200 dark:border-surface-700 font-extrabold text-heading bg-primary-50/10">
                    <td className="py-2.5 px-3">إجمالي الإيرادات التشغيلية</td>
                    <td className="py-2.5 px-3 font-mono text-left text-base text-primary-600">
                      {formatCurrency(displayRevenue, symbol)}
                    </td>
                  </tr>

                  {/* Category 2: COGS */}
                  <tr className="border-b border-surface-200 dark:border-surface-700 font-bold bg-surface-50/50 mt-4">
                    <td className="py-2.5 px-3 text-heading text-base" colSpan="2">ثانياً: تكلفة المبيعات (Cost of Goods Sold - COGS)</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-750">
                    <td className="py-2 px-6 text-muted">تكلفة الأجهزة المباعة تقسيط</td>
                    <td className="py-2 px-3 font-mono font-medium text-left">
                      {formatCurrency(accountingBasis === 'accrual' ? accrualCogsInstallment : cashCogsInstallmentPayments, symbol)}
                    </td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-750">
                    <td className="py-2 px-6 text-muted">تكلفة الأجهزة المباعة كاش / فوري</td>
                    <td className="py-2 px-3 font-mono font-medium text-left">
                      {formatCurrency(accountingBasis === 'accrual' ? accrualCogsCash : cashCogsDownPayments, symbol)}
                    </td>
                  </tr>
                  <tr className="border-b border-surface-200 dark:border-surface-700 font-extrabold text-heading bg-slate-50/10">
                    <td className="py-2.5 px-3">إجمالي تكلفة المبيعات</td>
                    <td className="py-2.5 px-3 font-mono text-left text-base text-slate-700 dark:text-slate-300">
                      {formatCurrency(displayCOGS, symbol)}
                    </td>
                  </tr>

                  {/* Category 3: Gross Profit */}
                  <tr className="border-b-2 border-surface-300 dark:border-surface-600 font-extrabold text-heading bg-gradient-to-r from-primary-50/5 to-transparent">
                    <td className="py-3 px-3 text-base text-primary-700 dark:text-primary-400">مجمل الربح (Gross Profit)</td>
                    <td className="py-3 px-3 font-mono text-left text-lg text-primary-700 dark:text-primary-400">
                      {formatCurrency(displayGrossProfit, symbol)}
                    </td>
                  </tr>

                  {/* Category 4: OPEX */}
                  <tr className="border-b border-surface-200 dark:border-surface-700 font-bold bg-surface-50/50">
                    <td className="py-2.5 px-3 text-heading text-base" colSpan="2">ثالثاً: المصاريف التشغيلية والإدارية (OPEX)</td>
                  </tr>
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                    <tr key={key} className="border-b border-surface-100 dark:border-surface-750">
                      <td className="py-2 px-6 text-muted">{label}</td>
                      <td className="py-2 px-3 font-mono text-left text-danger-600">
                        {categorySums[key] > 0 ? formatCurrency(categorySums[key], symbol) : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-surface-200 dark:border-surface-700 font-extrabold text-heading bg-red-50/10">
                    <td className="py-2.5 px-3">إجمالي المصاريف التشغيلية</td>
                    <td className="py-2.5 px-3 font-mono text-left text-base text-danger-600">
                      {formatCurrency(totalGeneralExpenses, symbol)}
                    </td>
                  </tr>

                  {/* Category 5: Net Profit */}
                  <tr className="border-b-2 border-surface-400 dark:border-surface-500 font-extrabold bg-gradient-to-r from-success-50/10 to-transparent">
                    <td className="py-3.5 px-3 text-lg text-heading">صافي الربح / الخسارة (Net Income)</td>
                    <td className={`py-3.5 px-3 font-mono text-left text-xl ${displayNetProfit >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                      {formatCurrency(displayNetProfit, symbol)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Relative Structure Progress bars */}
          <div className="card p-5 space-y-4 border border-surface-200 dark:border-surface-700 shadow-sm">
            <h3 className="font-bold text-heading text-sm">الهيكل المالي النسبي للتقرير</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>نسبة تكلفة الشراء (COGS) من الإيرادات</span>
                  <span className="font-bold text-heading">{displayRevenue > 0 ? ((displayCOGS / displayRevenue) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="h-2.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-500 rounded-full" style={{ width: `${displayRevenue > 0 ? (displayCOGS / displayRevenue) * 100 : 0}%` }} />
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>هامش مجمل الربح (Gross Profit Margin)</span>
                  <span className="font-bold text-heading">{displayRevenue > 0 ? ((displayGrossProfit / displayRevenue) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="h-2.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${displayRevenue > 0 ? (displayGrossProfit / displayRevenue) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>نسبة المصاريف التشغيلية (OPEX) من الإيرادات</span>
                  <span className="font-bold text-heading">{displayRevenue > 0 ? ((totalGeneralExpenses / displayRevenue) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="h-2.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${displayRevenue > 0 ? (totalGeneralExpenses / displayRevenue) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Profits Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50">
              <h3 className="font-bold text-heading text-sm">تفصيل أرباح العقود المبرمة خلال الفترة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-right text-xs">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800">
                    <th className="p-3">تاريخ الفاتورة</th>
                    <th className="p-3">الفاتورة / السلعة</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">سعر البيع</th>
                    <th className="p-3">سعر الشراء</th>
                    <th className="p-3">الربح المتوقع</th>
                    <th className="p-3">المحصل فعلياً</th>
                    <th className="p-3">الربح المحصل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {profitRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-muted text-sm">
                        لا توجد فواتير مبيعات مسجلة في هذه الفترة المحددة.
                      </td>
                    </tr>
                  ) : (
                    profitRows.map(({ contract, cost, expectedProfit, paidWithDp, collectedProfit }) => (
                      <tr key={contract.id} className="hover:bg-surface-50/50">
                        <td className="p-3 whitespace-nowrap">{formatDate(contract.start_date)}</td>
                        <td className="p-3 font-semibold text-heading">{contract.item_description}</td>
                        <td className="p-3 text-muted">{contract.clients?.name || 'مشتري نقدي'}</td>
                        <td className="p-3 font-medium">{formatCurrency(contract.total_price, symbol)}</td>
                        <td className="p-3 text-slate-500">{cost > 0 ? formatCurrency(cost, symbol) : '-'}</td>
                        <td className="p-3 font-medium text-primary-600">{formatCurrency(expectedProfit, symbol)}</td>
                        <td className="p-3 text-success-600">{formatCurrency(paidWithDp, symbol)}</td>
                        <td className="p-3 font-bold text-success-700">{formatCurrency(collectedProfit, symbol)}</td>
                      </tr>
                    ))
                  )}
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
      {/* 4. DETAILED EXPENSES TAB */}
      {/* ========================================== */}
      {activeTab === 'expenses' && (
        <div className="space-y-6 no-print">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-heading">تقرير وتحليل المصاريف العامة</h2>
            <button onClick={handleExportExpensesExcel} className="btn-secondary btn-sm flex items-center gap-1">
              <FileSpreadsheet size={14} />
              <span>تصدير Excel</span>
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Categories breakdown graph */}
            <div className="lg:col-span-1 card p-5 space-y-4">
              <h3 className="font-bold text-heading text-sm">توزيع المصاريف حسب الفئة</h3>
              <div className="space-y-4">
                {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => {
                  const amt = categorySums[key] || 0
                  const pct = totalGeneralExpenses > 0 ? (amt / totalGeneralExpenses) * 100 : 0
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs text-muted">
                        <span>{label}</span>
                        <span className="font-bold text-heading">{formatCurrency(amt, symbol)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Expenses List */}
            <div className="lg:col-span-2 card overflow-hidden">
              <div className="p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50">
                <h3 className="font-bold text-heading text-sm">سجل المصروفات العامة والتشغيلية</h3>
              </div>
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="table text-right text-xs">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-800">
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">البيان / العنوان</th>
                      <th className="p-3">الفئة</th>
                      <th className="p-3">الملاحظات</th>
                      <th className="p-3">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {expenses?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-muted text-sm">
                          لا توجد مصاريف مسجلة حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      expenses?.map(e => (
                        <tr key={e.id} className="hover:bg-surface-50/50">
                          <td className="p-3 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                          <td className="p-3 font-semibold text-heading">{e.title}</td>
                          <td className="p-3 text-muted">{EXPENSE_CATEGORIES[e.category] || e.category || 'أخرى'}</td>
                          <td className="p-3 text-muted truncate max-w-[150px]">{e.notes || '-'}</td>
                          <td className="p-3 font-bold text-danger-600">{formatCurrency(e.amount, symbol)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
            <h2 className="text-center text-lg font-bold py-2 bg-slate-100 rounded-lg">
              بيان الأرباح والخسائر (قائمة الدخل) - {accountingBasis === 'accrual' ? 'أساس الاستحقاق' : 'الأساس النقدي'}
            </h2>
            <div className="text-center text-xs text-slate-500 mb-4">
              الفترة: من {formatDate(pnlDateFrom)} إلى {formatDate(pnlDateTo)}
            </div>
            
            <table className="w-full text-xs text-right border-collapse border border-slate-200">
              <tbody>
                {/* Category 1: Revenue */}
                <tr className="bg-slate-100 font-bold border-b border-slate-300">
                  <td className="p-2 text-slate-900" colSpan="2">أولاً: الإيرادات التشغيلية (Revenue)</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 pr-6 text-slate-600">إيرادات المبيعات بالتقسيط (أقساط الفترة)</td>
                  <td className="p-2 font-bold text-left">
                    {formatCurrency(accountingBasis === 'accrual' ? accrualRevenueInstallment : cashRevenueInstallmentPayments, symbol)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 pr-6 text-slate-600">إيرادات المبيعات النقدية (مقدمات كاش)</td>
                  <td className="p-2 font-bold text-left">
                    {formatCurrency(accountingBasis === 'accrual' ? accrualRevenueCash : cashRevenueDownPayments, symbol)}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold border-b border-slate-300">
                  <td className="p-2 text-slate-900">إجمالي الإيرادات التشغيلية</td>
                  <td className="p-2 text-primary-700 text-left text-sm">
                    {formatCurrency(displayRevenue, symbol)}
                  </td>
                </tr>

                {/* Category 2: COGS */}
                <tr className="bg-slate-100 font-bold border-b border-slate-300">
                  <td className="p-2 text-slate-900" colSpan="2">ثانياً: تكلفة المبيعات (COGS)</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 pr-6 text-slate-600">تكلفة الأجهزة المباعة تقسيط</td>
                  <td className="p-2 font-bold text-left">
                    {formatCurrency(accountingBasis === 'accrual' ? accrualCogsInstallment : cashCogsInstallmentPayments, symbol)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 pr-6 text-slate-600">تكلفة الأجهزة المباعة كاش / فوري</td>
                  <td className="p-2 font-bold text-left">
                    {formatCurrency(accountingBasis === 'accrual' ? accrualCogsCash : cashCogsDownPayments, symbol)}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold border-b border-slate-300">
                  <td className="p-2 text-slate-900">إجمالي تكلفة المبيعات</td>
                  <td className="p-2 text-slate-800 text-left text-sm">
                    {formatCurrency(displayCOGS, symbol)}
                  </td>
                </tr>

                {/* Category 3: Gross Profit */}
                <tr className="bg-slate-200 font-bold border-b border-slate-400">
                  <td className="p-3 text-sm text-primary-800">مجمل الربح (Gross Profit)</td>
                  <td className="p-3 text-primary-800 text-left text-base">
                    {formatCurrency(displayGrossProfit, symbol)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200 text-[10px] text-slate-500">
                  <td className="p-1 pr-4">هامش مجمل الربح (%)</td>
                  <td className="p-1 text-left font-bold">{grossMarginPct.toFixed(1)}%</td>
                </tr>

                {/* Category 4: OPEX */}
                <tr className="bg-slate-100 font-bold border-b border-slate-300">
                  <td className="p-2 text-slate-900" colSpan="2">ثالثاً: المصاريف التشغيلية والإدارية (OPEX)</td>
                </tr>
                {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                  <tr key={key} className="border-b border-slate-200">
                    <td className="p-2 pr-6 text-slate-600">{label}</td>
                    <td className="p-2 font-bold text-left text-red-700">
                      {categorySums[key] > 0 ? formatCurrency(categorySums[key], symbol) : '-'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold border-b border-slate-300">
                  <td className="p-2 text-slate-900">إجمالي المصاريف التشغيلية</td>
                  <td className="p-2 text-red-700 text-left text-sm">
                    {formatCurrency(totalGeneralExpenses, symbol)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200 text-[10px] text-slate-500">
                  <td className="p-1 pr-4">نسبة المصاريف من الإيرادات (%)</td>
                  <td className="p-1 text-left font-bold">{opexRatioPct.toFixed(1)}%</td>
                </tr>

                {/* Category 5: Net Profit */}
                <tr className="bg-slate-300 font-bold border-b-2 border-slate-500">
                  <td className="p-3 text-base text-slate-900">صافي الربح / الخسارة (Net Income)</td>
                  <td className={`p-3 text-left text-lg ${displayNetProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                    {formatCurrency(displayNetProfit, symbol)}
                  </td>
                </tr>
                <tr className="text-[10px] text-slate-500">
                  <td className="p-1 pr-4">صافي هامش الربح (%)</td>
                  <td className="p-1 text-left font-bold">{netMarginPct.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-bold text-xs mt-6">تفصيل عقود الفترة المحددة</h3>
            <table className="w-full text-[10px] text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 border border-slate-200">التاريخ</th>
                  <th className="p-2 border border-slate-200">العقد / السلعة</th>
                  <th className="p-2 border border-slate-200">العميل</th>
                  <th className="p-2 border border-slate-200">سعر البيع</th>
                  <th className="p-2 border border-slate-200">سعر الشراء</th>
                  <th className="p-2 border border-slate-200">الربح المتوقع</th>
                  <th className="p-2 border border-slate-200">المحصل فعلياً</th>
                  <th className="p-2 border border-slate-200 font-bold">الربح المحصل</th>
                </tr>
              </thead>
              <tbody>
                {profitRows.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-4 text-center text-slate-400">
                      لا توجد فواتير مبيعات مسجلة في هذه الفترة المحددة.
                    </td>
                  </tr>
                ) : (
                  profitRows.map(({ contract, cost, expectedProfit, paidWithDp, collectedProfit }) => (
                    <tr key={contract.id} className="border-b border-slate-200">
                      <td className="p-2 border border-slate-200">{formatDate(contract.start_date)}</td>
                      <td className="p-2 border border-slate-200 font-semibold">{contract.item_description}</td>
                      <td className="p-2 border border-slate-200">{contract.clients?.name || 'مشتري نقدي'}</td>
                      <td className="p-2 border border-slate-200">{formatCurrency(contract.total_price, symbol)}</td>
                      <td className="p-2 border border-slate-200">{cost > 0 ? formatCurrency(cost, symbol) : '-'}</td>
                      <td className="p-2 border border-slate-200 text-primary-700">{formatCurrency(expectedProfit, symbol)}</td>
                      <td className="p-2 border border-slate-200 text-green-700">{formatCurrency(paidWithDp, symbol)}</td>
                      <td className="p-2 border border-slate-200 font-bold text-green-800">{formatCurrency(collectedProfit, symbol)}</td>
                    </tr>
                  ))
                )}
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

        {/* 4. Print Expenses */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <h2 className="text-center text-lg font-bold py-2 bg-slate-100 rounded-lg">تقرير المصروفات العامة والتشغيلية الموحد</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-200 p-4 rounded-lg">
                <h3 className="font-bold text-xs mb-3 border-b pb-1">ملخص فئات المصروفات</h3>
                <table className="w-full text-xs text-right">
                  <tbody>
                    {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => {
                      const amt = categorySums[key] || 0
                      const pct = totalGeneralExpenses > 0 ? (amt / totalGeneralExpenses) * 100 : 0
                      return (
                        <tr key={key} className="border-b last:border-0">
                          <td className="py-1.5 text-slate-500">{label}</td>
                          <td className="py-1.5 font-bold text-left">{formatCurrency(amt, symbol)} ({pct.toFixed(0)}%)</td>
                        </tr>
                      )
                    })}
                    <tr className="font-bold bg-slate-50 border-t">
                      <td className="py-1.5">إجمالي المصروفات</td>
                      <td className="py-1.5 text-left text-danger-700">{formatCurrency(totalGeneralExpenses, symbol)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h3 className="font-bold text-xs mt-6">سجل حركات المصروفات العامة</h3>
            <table className="w-full text-[10px] text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 border border-slate-200">التاريخ</th>
                  <th className="p-2 border border-slate-200">العنوان</th>
                  <th className="p-2 border border-slate-200">الفئة</th>
                  <th className="p-2 border border-slate-200">الملاحظات</th>
                  <th className="p-2 border border-slate-200">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {expenses?.map(e => (
                  <tr key={e.id} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-200">{formatDate(e.expense_date)}</td>
                    <td className="p-2 border border-slate-200 font-bold">{e.title}</td>
                    <td className="p-2 border border-slate-200">{EXPENSE_CATEGORIES[e.category] || e.category}</td>
                    <td className="p-2 border border-slate-200">{e.notes || '-'}</td>
                    <td className="p-2 border border-slate-200 font-bold text-danger-700">{formatCurrency(e.amount, symbol)}</td>
                  </tr>
                ))}
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
