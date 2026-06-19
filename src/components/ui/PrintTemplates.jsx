import { formatDate, formatCurrency } from '@/lib/utils'

// 1. قالب إيصال استلام قسط (Installment Payment Receipt)
export function ReceiptPrintTemplate({ paymentData, installment, clientName, businessSettings }) {
  if (!installment) return null

  const businessName = businessSettings?.business_name || 'محل التقسيط'
  const ownerName = businessSettings?.owner_name || 'صاحب المحل'
  const currencySymbol = businessSettings?.currency_symbol || 'ج.م'

  // Current payment values
  const paidAmount = paymentData?.amount || installment.amount
  const payDate = paymentData?.paymentDate || new Date().toISOString().split('T')[0]
  const payMethod = paymentData?.method || 'cash'
  
  const methodLabel = {
    cash: 'نقدي',
    transfer: 'تحويل بنكي',
    check: 'شيك',
    other: 'أخرى'
  }[payMethod] || 'نقدي'

  const remainingInstallmentAmount = installment.remaining_amount - paidAmount

  return (
    <div className="print-only w-full max-w-md mx-auto p-6 bg-white border border-slate-300 text-slate-800 space-y-6 dir-rtl text-right">
      {/* Header */}
      <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300">
        <h1 className="text-2xl font-bold text-slate-900">{businessName}</h1>
        <p className="text-xs text-slate-500">إدارة مبيعات وتقسيط الأجهزة</p>
        <p className="text-xs text-slate-500">رقم الهاتف: {businessSettings?.phone || '-'}</p>
      </div>

      {/* Title */}
      <div className="text-center py-2 bg-slate-100 rounded-lg">
        <h2 className="text-base font-bold text-slate-800">إيصال استلام دفعة قسط</h2>
      </div>

      {/* Details */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">اسم العميـل:</span>
          <span className="font-bold text-slate-900">{clientName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">تاريخ الدفع:</span>
          <span className="font-medium">{formatDate(payDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">السلعة / البضاعة:</span>
          <span className="font-medium">{installment.contracts?.item_description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">رقم القسط:</span>
          <span className="font-medium">قسط رقم {installment.installment_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">طريقة الدفع:</span>
          <span className="font-medium">{methodLabel}</span>
        </div>
        {paymentData?.referenceNumber && (
          <div className="flex justify-between">
            <span className="text-slate-500">رقم المرجع/الشيك:</span>
            <span className="font-mono text-xs">{paymentData.referenceNumber}</span>
          </div>
        )}
      </div>

      {/* Financial Box */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <div className="flex justify-between text-base">
          <span className="font-bold text-slate-900">المبلغ المدفوع:</span>
          <span className="text-lg font-bold text-green-700">{formatCurrency(paidAmount, currencySymbol)}</span>
        </div>
        <div className="flex justify-between text-xs pt-2 border-t border-slate-200 text-slate-500">
          <span>المتبقي من هذا القسط:</span>
          <span className="font-semibold text-slate-700">
            {formatCurrency(Math.max(0, remainingInstallmentAmount), currencySymbol)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-4 text-center text-xs">
        <div>
          <p className="text-slate-400 mb-10">توقيع المستلم</p>
          <p className="font-bold border-t border-slate-200 pt-2">{ownerName}</p>
        </div>
        <div>
          <p className="text-slate-400 mb-10">توقيع العميل</p>
          <p className="font-bold border-t border-slate-200 pt-2">{clientName}</p>
        </div>
      </div>

      <div className="text-center pt-4 text-[9px] text-slate-400">
        تم التوليد تلقائياً بواسطة نظام التقسيط المحاسبي
      </div>
    </div>
  )
}

// 2. قالب كشف حساب عميل كامل (Full Client Statement & Contract Report)
export function StatementPrintTemplate({ client, symbol, businessSettings }) {
  if (!client) return null

  const businessName = businessSettings?.business_name || 'محل التقسيط'
  const ownerName = businessSettings?.owner_name || 'صاحب المحل'

  // Total balance calculations
  const totalBalance = client.contracts?.reduce((sum, c) => {
    return sum + (c.installments?.reduce((s, i) => s + (i.status !== 'paid' ? i.remaining_amount : 0), 0) || 0)
  }, 0) || 0

  return (
    <div className="print-only w-full p-8 bg-white text-slate-800 space-y-6 dir-rtl text-right">
      {/* Letterhead */}
      <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{businessName}</h1>
          <p className="text-xs text-slate-500 mt-1">لتقسيط الأجهزة الكهربائية والإلكترونية</p>
          <p className="text-xs text-slate-500">المالك: {ownerName}</p>
        </div>
        <div className="text-left text-xs text-slate-500">
          <p>التاريخ: {formatDate(new Date().toISOString().split('T')[0])}</p>
          <p>الصفحة: 1 من 1</p>
        </div>
      </div>

      <div className="text-center py-3 bg-slate-100 rounded-xl">
        <h2 className="text-lg font-bold text-slate-800">تقرير كشف حساب تفصيلي للعميل</h2>
      </div>

      {/* Client Profile */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
        <div className="space-y-1.5">
          <div><span className="text-slate-400 ml-2">اسم العميـل:</span> <strong className="text-slate-800">{client.name}</strong></div>
          <div><span className="text-slate-400 ml-2">رقم الهاتف:</span> <span dir="ltr">{client.phone || '-'}</span></div>
          <div><span className="text-slate-400 ml-2">العنـوان:</span> <span>{client.address || '-'}</span></div>
        </div>
        <div className="space-y-1.5 text-left">
          <div><span className="text-slate-400 ml-2">الرقم القومي:</span> <span dir="ltr">{client.national_id || '-'}</span></div>
          <div className="pt-2 border-t border-slate-200 mt-2">
            <span className="text-slate-500 font-bold ml-2">إجمالي المديونية الحالية:</span>
            <strong className="text-red-600 text-base">{formatCurrency(totalBalance, symbol)}</strong>
          </div>
        </div>
      </div>

      {/* Contracts & Installments Schedule */}
      <div className="space-y-6">
        {client.contracts?.map((contract, cIdx) => (
          <div key={contract.id} className="space-y-3 p-4 border border-slate-200 rounded-xl">
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
              <h3 className="font-bold text-slate-900 text-sm">
                عقد رقم {cIdx + 1}: {contract.item_description}
              </h3>
              <span className="text-xs text-slate-500">
                البداية: {formatDate(contract.start_date)} | القسط الشهري: {formatCurrency(contract.installment_amount, symbol)}
              </span>
            </div>

            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 font-bold">#</th>
                  <th className="p-2 font-bold">تاريخ الاستحقاق</th>
                  <th className="p-2 font-bold">مبلغ القسط</th>
                  <th className="p-2 font-bold">المتبقي منه</th>
                  <th className="p-2 font-bold">الحالة</th>
                  <th className="p-2 font-bold">تاريخ السداد</th>
                </tr>
              </thead>
              <tbody>
                {contract.installments?.map(inst => (
                  <tr key={inst.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-2 font-mono">{inst.installment_number}</td>
                    <td className="p-2">{formatDate(inst.due_date)}</td>
                    <td className="p-2">{formatCurrency(inst.amount, symbol)}</td>
                    <td className="p-2 font-bold">{formatCurrency(inst.remaining_amount, symbol)}</td>
                    <td className="p-2">
                      <span className={{
                        paid: 'text-green-600 font-bold',
                        late: 'text-red-600 font-bold',
                        partial: 'text-amber-600 font-bold',
                        pending: 'text-slate-500'
                      }[inst.status]}>
                        {{
                          paid: 'مدفوع',
                          late: 'متأخر',
                          partial: 'مدفوع جزئي',
                          pending: 'معلق'
                        }[inst.status]}
                      </span>
                    </td>
                    <td className="p-2 text-slate-500">{inst.payment_date ? formatDate(inst.payment_date) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-8 grid grid-cols-2 gap-4 text-center text-xs">
        <div>
          <p className="text-slate-400 mb-14">توقيع المالك</p>
          <p className="font-bold border-t border-slate-300 pt-2">{ownerName}</p>
        </div>
        <div>
          <p className="text-slate-400 mb-14">توقيع العميل</p>
          <p className="font-bold border-t border-slate-300 pt-2">{client.name}</p>
        </div>
      </div>
    </div>
  )
}
