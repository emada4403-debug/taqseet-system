import { useState } from 'react'
import { useReport, useSettings } from '@/hooks/useApi'
import { formatCurrency, formatDate, getAgingBucket } from '@/lib/utils'
import { PageLoader } from '@/components/ui/States'
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

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

function CashflowReport({ symbol }) {
  const today = new Date()
  const [params, setParams] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const { data, isLoading } = useReport('cashflow', params)
  const { data: settings } = useSettings()

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFont('helvetica')
    doc.text(`Cash Flow Report - ${MONTHS_AR[params.month - 1]} ${params.year}`, 14, 15)

    autoTable(doc, {
      head: [['Date', 'Type', 'Party', 'Description', 'Amount', 'Status']],
      body: [
        ...(data?.receivables || []).map(i => [
          i.due_date, 'Receivable',
          i.contracts?.clients?.name || '', i.contracts?.item_description || '',
          formatCurrency(i.amount, symbol), i.status
        ]),
        ...(data?.payables || []).map(i => [
          i.due_date, 'Payable',
          i.contracts?.suppliers?.name || '', i.contracts?.item_description || '',
          formatCurrency(i.amount, symbol), i.status
        ]),
      ],
      startY: 25,
    })
    doc.save(`cashflow_${params.year}_${params.month}.pdf`)
  }

  const exportExcel = () => {
    const rows = [
      ['تاريخ', 'نوع', 'الطرف', 'البضاعة', 'المبلغ', 'الحالة'],
      ...(data?.receivables || []).map(i => [
        i.due_date, 'مديونية', i.contracts?.clients?.name, i.contracts?.item_description,
        parseFloat(i.amount), i.status
      ]),
      ...(data?.payables || []).map(i => [
        i.due_date, 'مستحقة', i.contracts?.suppliers?.name, i.contracts?.item_description,
        parseFloat(i.amount), i.status
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير')
    XLSX.writeFile(wb, `cashflow_${params.year}_${params.month}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-36"
          value={params.month} onChange={e => setParams(p => ({ ...p, month: parseInt(e.target.value) }))}>
          {MONTHS_AR.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select className="input w-28"
          value={params.year} onChange={e => setParams(p => ({ ...p, year: parseInt(e.target.value) }))}>
          {[2023, 2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={exportPDF} className="btn-secondary btn-sm">
          <Download size={14} />
          PDF
        </button>
        <button onClick={exportExcel} className="btn-secondary btn-sm">
          <FileSpreadsheet size={14} />
          Excel
        </button>
      </div>

      {isLoading ? <PageLoader /> : data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'متوقع القبض', value: data.expectedReceivables, color: 'text-success-600', icon: TrendingUp },
              { label: 'فعلي المقبوض', value: data.actualReceivables, color: 'text-success-700', icon: TrendingUp },
              { label: 'متوقع الدفع', value: data.expectedPayables, color: 'text-danger-600', icon: TrendingDown },
              { label: 'فعلي المدفوع', value: data.actualPayables, color: 'text-danger-700', icon: TrendingDown },
            ].map(item => (
              <div key={item.label} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon size={16} className={item.color} />
                  <span className="text-xs text-muted">{item.label}</span>
                </div>
                <div className={`text-lg font-bold ${item.color}`}>
                  {formatCurrency(item.value, symbol)}
                </div>
              </div>
            ))}
          </div>

          {/* Net */}
          <div className="card p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-heading">صافي الشهر</span>
              <span className={`text-xl font-bold ${
                data.actualReceivables - data.actualPayables >= 0
                  ? 'text-success-600' : 'text-danger-600'
              }`}>
                {formatCurrency(Math.abs(data.actualReceivables - data.actualPayables), symbol)}
                <span className="text-sm font-normal text-muted mr-1">
                  {data.actualReceivables - data.actualPayables >= 0 ? 'ربح' : 'خسارة'}
                </span>
              </span>
            </div>
          </div>

          {/* Details Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>الطرف</th>
                  <th>البضاعة</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {[...(data.receivables || []), ...(data.payables || [])]
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))
                  .map(inst => (
                    <tr key={inst.id}>
                      <td>{formatDate(inst.due_date)}</td>
                      <td>
                        <span className={`badge ${inst.contracts?.type === 'RECEIVABLE' ? 'badge-paid' : 'badge-late'}`}>
                          {inst.contracts?.type === 'RECEIVABLE' ? 'مديونية' : 'مستحقة'}
                        </span>
                      </td>
                      <td>{inst.contracts?.clients?.name || inst.contracts?.suppliers?.name}</td>
                      <td className="max-w-xs truncate">{inst.contracts?.item_description}</td>
                      <td className="font-semibold">{formatCurrency(inst.amount, symbol)}</td>
                      <td>
                        <span className={`badge ${
                          inst.status === 'paid' ? 'badge-paid' :
                          inst.status === 'late' ? 'badge-late' :
                          inst.status === 'partial' ? 'badge-partial' : 'badge-pending'
                        }`}>
                          {inst.status === 'paid' ? 'مدفوع' : inst.status === 'late' ? 'متأخر' : inst.status === 'partial' ? 'جزئي' : 'معلق'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function AgingReport({ symbol }) {
  const { data, isLoading } = useReport('aging', {})

  const exportExcel = () => {
    if (!data) return
    const rows = [['أيام التأخير', 'التاريخ', 'الطرف', 'البضاعة', 'المبلغ', 'الأيام']]
    Object.entries(data).forEach(([bucket, items]) => {
      items.forEach(i => {
        rows.push([
          AGING_LABELS[bucket],
          i.due_date,
          i.contracts?.clients?.name || i.contracts?.suppliers?.name,
          i.contracts?.item_description,
          parseFloat(i.remaining_amount),
          i.daysOverdue
        ])
      })
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير التأخير')
    XLSX.writeFile(wb, 'aging_report.xlsx')
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={exportExcel} className="btn-secondary btn-sm">
          <FileSpreadsheet size={14} />
          تصدير Excel
        </button>
      </div>

      {Object.entries(data || {}).map(([bucket, items]) => (
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
                <span className="text-xs text-muted mr-2">({items.length} قسط)</span>
              </div>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="divide-y divide-surface-100 dark:divide-surface-700">
              {items.map(inst => (
                <div key={inst.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-heading">
                      {inst.contracts?.clients?.name || inst.contracts?.suppliers?.name}
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
            <div className="p-4 text-center text-muted text-sm">لا توجد أقساط في هذا النطاق ✓</div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('cashflow')
  const { data: settings } = useSettings()
  const symbol = settings?.currency_symbol || 'ج.م'

  const tabs = [
    { id: 'cashflow', label: 'التدفق النقدي', icon: BarChart3 },
    { id: 'aging', label: 'تقرير التأخير', icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">التقارير</h1>
        <p className="text-muted text-sm">تحليل مالي شامل لأعمالك</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-surface-700 text-heading shadow-card'
                : 'text-muted hover:text-heading'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cashflow' && <CashflowReport symbol={symbol} />}
      {activeTab === 'aging' && <AgingReport symbol={symbol} />}
    </div>
  )
}
