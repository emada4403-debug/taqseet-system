import { useState } from 'react'
import { useProducts, useCreateProduct, useUpdateProduct, useSettings, useSuppliers } from '@/hooks/useApi'
import { formatCurrency } from '@/lib/utils'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/States'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/context/ToastContext'
import { Package, Plus, Search, Edit, Barcode, DollarSign, TrendingUp, Layers } from 'lucide-react'

function ProductForm({ initialData = {}, onSubmit, loading, isEdit = false }) {
  const { data: suppliers } = useSuppliers()
  const [form, setForm] = useState({
    name: initialData.name || '',
    sku: initialData.sku || '',
    purchase_price: initialData.purchase_price || '',
    stock: initialData.stock || '1',
    // Financial details
    purchaseMethod: 'cash', // 'cash' | 'credit'
    supplierId: '',
    downPayment: '0',
    installmentCount: '1'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      name: form.name,
      sku: form.sku,
      purchase_price: parseFloat(form.purchase_price) || 0,
      cash_price: 0,
      installment_price: 0,
      stock: parseInt(form.stock) || 0,
      purchaseMethod: form.purchaseMethod,
      supplierId: form.supplierId,
      downPayment: parseFloat(form.downPayment) || 0,
      installmentCount: parseInt(form.installmentCount) || 1
    })
  }

  return (
    <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="label">اسم السلعة / الموديل *</label>
        <input 
          className="input" 
          placeholder="مثال: iPhone 15 Pro Max 256GB" 
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
          required 
        />
      </div>
      
      <div className="form-group">
        <label className="label">الرقم التسلسلي (Serial Number) / الباركود</label>
        <div className="relative">
          <input 
            className="input pr-10" 
            placeholder="مثال: IMEI أو باركود السلعة" 
            value={form.sku}
            onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} 
            dir="ltr"
          />
          <Barcode size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="form-group">
          <label className="label">سعر الشراء (التكلفة) *</label>
          <input 
            type="number" 
            className="input" 
            placeholder="0" 
            value={form.purchase_price}
            onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} 
            required 
          />
        </div>
        <div className="form-group">
          <label className="label">الكمية المتوفرة بالمخزن *</label>
          <input 
            type="number" 
            className="input" 
            placeholder="0" 
            value={form.stock}
            onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} 
            required 
            min="1"
          />
        </div>
      </div>

      {!isEdit && (
        <div className="bg-surface-50 dark:bg-surface-800/40 p-4 rounded-xl border border-surface-200 dark:border-surface-700/50 space-y-4 mt-2">
          <h3 className="text-xs font-bold text-heading">الموقف المالي وطريقة الشراء للسلعة</h3>
          
          <div className="form-group">
            <label className="label">طريقة الدفع للمخزون *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, purchaseMethod: 'cash' }))}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                  form.purchaseMethod === 'cash'
                    ? 'border-success-500 bg-success-50 dark:bg-success-950/20 text-success-700 dark:text-success-400'
                    : 'border-surface-200 dark:border-surface-700 text-muted hover:border-success-300'
                }`}
              >
                شراء نقدي (كاش - يخصم من الخزينة)
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, purchaseMethod: 'credit' }))}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                  form.purchaseMethod === 'credit'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400'
                    : 'border-surface-200 dark:border-surface-700 text-muted hover:border-primary-300'
                }`}
              >
                شراء بالآجل (حساب مورد)
              </button>
            </div>
          </div>

          {form.purchaseMethod === 'credit' && (
            <div className="space-y-3">
              <div className="form-group">
                <label className="label">اختر المورد المالي *</label>
                <select
                  className="input text-xs"
                  value={form.supplierId}
                  onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                  required={form.purchaseMethod === 'credit'}
                >
                  <option value="">-- اختر مورد --</option>
                  {suppliers?.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">الدفعة الأولى / المقدم</label>
                  <input
                    type="number"
                    className="input text-xs"
                    placeholder="0"
                    value={form.downPayment}
                    onChange={e => setForm(f => ({ ...f, downPayment: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="label">عدد أقساط المورد</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="input text-xs"
                    value={form.installmentCount}
                    onChange={e => setForm(f => ({ ...f, installmentCount: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}

export default function Inventory() {
  const { data: products, isLoading, error, refetch } = useProducts()
  const { data: settings } = useSettings()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  const symbol = settings?.currency_symbol || 'ج.م'

  const filtered = products?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  ) || []

  // Calculated Inventory Statistics
  const totalStockItems = products?.reduce((sum, p) => sum + (p.stock || 0), 0) || 0
  const totalPurchaseValue = products?.reduce((sum, p) => sum + (p.purchase_price * (p.stock || 0)), 0) || 0

  const handleCreate = async (formData) => {
    try {
      await createProduct.mutateAsync({
        productData: {
          name: formData.name,
          sku: formData.sku,
          purchase_price: formData.purchase_price,
          stock: formData.stock
        },
        purchaseMethod: formData.purchaseMethod,
        supplierId: formData.supplierId,
        downPayment: formData.downPayment,
        installmentCount: formData.installmentCount
      })
      toast.success('تم إضافة المنتج وتحديث الحسابات بنجاح ✓')
      setShowAdd(false)
    } catch (err) {
      toast.error(err.message || 'فشل إضافة المنتج')
    }
  }

  const handleUpdate = async (formData) => {
    try {
      await updateProduct.mutateAsync({
        id: selectedProduct.id,
        name: formData.name,
        sku: formData.sku,
        purchase_price: formData.purchase_price,
        stock: formData.stock
      })
      toast.success('تم تحديث بيانات المنتج بنجاح')
      setSelectedProduct(null)
    } catch (err) {
      toast.error(err.message || 'فشل تحديث المنتج')
    }
  }

  if (isLoading) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">إدارة المخزن</h1>
          <p className="text-muted text-sm">{products?.length || 0} سلعة مسجلة</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={18} />
          <span>إضافة سلعة جديدة</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">أنواع البضائع</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600">
              <Layers size={16} />
            </div>
          </div>
          <div className="stat-value">{products?.length || 0} سلعة</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">إجمالي الوحدات بالمخزن</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
              <Package size={16} />
            </div>
          </div>
          <div className="stat-value">{totalStockItems} وحدة</div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">قيمة رأس المال (الشراء)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(totalPurchaseValue, symbol)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          className="input pr-10"
          placeholder="بحث باسم السلعة أو الرقم التسلسلي/الباركود..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Products Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="لا توجد بضائع"
          description="أضف بضائع أو هواتف للمخزن لتبدأ في إدارتها وبيعها بالتقسيط"
          action={
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={18} />
              إضافة سلعة
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(product => (
            <div key={product.id} className="card p-4 space-y-3 relative overflow-hidden">
              {/* Product Info */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-heading text-base leading-snug">{product.name}</h3>
                  {product.sku && (
                    <div className="text-xs text-muted flex items-center gap-1 mt-1 font-mono">
                      <Barcode size={12} />
                      <span>{product.sku}</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedProduct(product)}
                  className="btn-ghost btn-icon p-1.5 text-slate-400 hover:text-sky-600"
                >
                  <Edit size={16} />
                </button>
              </div>

              {/* Price details */}
              <div className="py-2 border-y border-slate-100 dark:border-slate-700 text-xs flex justify-between">
                <span className="text-muted">سعر الشراء (التكلفة):</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(product.purchase_price, symbol)}</span>
              </div>

              {/* Stock status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">الكمية المتوفرة:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  product.stock > 3 
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' 
                    : product.stock > 0 
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                }`}>
                  {product.stock === 0 ? 'نفذت الكمية' : `${product.stock} وحدات`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="إضافة سلعة جديدة للمخزن"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">إلغاء</button>
            <button
              form="product-form"
              type="submit"
              className="btn-primary flex-1"
              disabled={createProduct.isPending}
            >
              {createProduct.isPending ? 'جاري الحفظ...' : 'حفظ وإضافة'}
            </button>
          </div>
        }
      >
        <ProductForm onSubmit={handleCreate} loading={createProduct.isPending} />
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title="تعديل بيانات البضاعة"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setSelectedProduct(null)} className="btn-secondary flex-1">إلغاء</button>
            <button
              form="product-form"
              type="submit"
              className="btn-primary flex-1"
              disabled={updateProduct.isPending}
            >
              {updateProduct.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        }
      >
        {selectedProduct && (
          <ProductForm 
            initialData={selectedProduct} 
            onSubmit={handleUpdate} 
            loading={updateProduct.isPending} 
            isEdit={true}
          />
        )}
      </Modal>
    </div>
  )
}
