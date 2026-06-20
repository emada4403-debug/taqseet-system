import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Determine if we have real configured Supabase credentials
const isConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  !supabaseUrl.includes('your-project-id') &&
  supabaseUrl !== 'https://placeholder.supabase.co'
)

// ===================================================
// LOCAL DB ENGINE FOR ZERO-CONFIG DEMO MODE
// ===================================================
let authCallbacks = []

class MockQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName
    this.filters = []
    this.sorts = []
    this.limitCount = null
    this.isSingle = false
    this.isMaybeSingle = false
  }

  // Retrieve current array from localStorage
  getData() {
    return JSON.parse(localStorage.getItem(`taqseet_db_${this.tableName}`) || '[]')
  }

  select(fields = '*') {
    this.selectFields = fields
    return this
  }

  eq(column, value) {
    this.filters.push(item => item[column] === value)
    return this
  }

  neq(column, value) {
    this.filters.push(item => item[column] !== value)
    return this
  }

  in(column, values) {
    this.filters.push(item => values.includes(item[column]))
    return this
  }

  gte(column, value) {
    this.filters.push(item => item[column] >= value)
    return this
  }

  lte(column, value) {
    this.filters.push(item => item[column] <= value)
    return this
  }

  lt(column, value) {
    this.filters.push(item => item[column] < value)
    return this
  }

  order(column, options = {}) {
    const ascending = options.ascending !== false
    this.sorts.push((a, b) => {
      if (a[column] < b[column]) return ascending ? -1 : 1
      if (a[column] > b[column]) return ascending ? 1 : -1
      return 0
    })
    return this
  }

  limit(num) {
    this.limitCount = num
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  maybeSingle() {
    this.isMaybeSingle = true
    return this
  }

  async then(onfulfilled, onrejected) {
    try {
      const result = await this.execute()
      return onfulfilled(result)
    } catch (err) {
      if (onrejected) return onrejected(err)
      throw err
    }
  }

  async execute() {
    let list = this.getData()

    // Apply filters
    for (const filter of this.filters) {
      list = list.filter(filter)
    }

    // Apply sorts
    for (const sort of this.sorts) {
      list.sort(sort)
    }

    // Populate relations
    list = list.map(item => this.populateItem(item))

    // Apply limit
    if (this.limitCount !== null) {
      list = list.slice(0, this.limitCount)
    }

    if (this.isSingle) {
      if (list.length === 0) {
        throw new Error(`Row in ${this.tableName} not found`)
      }
      return { data: list[0], error: null }
    }

    if (this.isMaybeSingle) {
      return { data: list[0] || null, error: null }
    }

    return { data: list, error: null }
  }

  populateItem(item) {
    const cloned = { ...item }

    if (this.tableName === 'installments') {
      const contracts = JSON.parse(localStorage.getItem('taqseet_db_contracts') || '[]')
      const contract = contracts.find(c => c.id === cloned.contract_id)
      if (contract) {
        cloned.contracts = this.populateRelation('contracts', contract)
      }
      const payments = JSON.parse(localStorage.getItem('taqseet_db_payments') || '[]')
      cloned.payments = payments.filter(p => p.installment_id === cloned.id)
    }

    if (this.tableName === 'contracts') {
      if (cloned.client_id) {
        const clients = JSON.parse(localStorage.getItem('taqseet_db_clients') || '[]')
        cloned.clients = clients.find(c => c.id === cloned.client_id)
      }
      if (cloned.supplier_id) {
        const suppliers = JSON.parse(localStorage.getItem('taqseet_db_suppliers') || '[]')
        cloned.suppliers = suppliers.find(s => s.id === cloned.supplier_id)
      }
      const installments = JSON.parse(localStorage.getItem('taqseet_db_installments') || '[]')
      cloned.installments = installments
        .filter(i => i.contract_id === cloned.id)
        .map(i => {
          const payments = JSON.parse(localStorage.getItem('taqseet_db_payments') || '[]')
          return {
            ...i,
            payments: payments.filter(p => p.installment_id === i.id)
          }
        })
    }

    if (this.tableName === 'clients') {
      const contracts = JSON.parse(localStorage.getItem('taqseet_db_contracts') || '[]')
      cloned.contracts = contracts
        .filter(c => c.client_id === cloned.id)
        .map(c => this.populateRelation('contracts', c))
    }

    if (this.tableName === 'suppliers') {
      const contracts = JSON.parse(localStorage.getItem('taqseet_db_contracts') || '[]')
      cloned.contracts = contracts
        .filter(c => c.supplier_id === cloned.id)
        .map(c => this.populateRelation('contracts', c))
    }

    if (this.tableName === 'payments') {
      const contracts = JSON.parse(localStorage.getItem('taqseet_db_contracts') || '[]')
      cloned.contracts = contracts.find(c => c.id === cloned.contract_id)
    }

    return cloned
  }

  populateRelation(relationName, item) {
    const cloned = { ...item }
    if (relationName === 'contracts') {
      if (cloned.client_id) {
        const clients = JSON.parse(localStorage.getItem('taqseet_db_clients') || '[]')
        cloned.clients = clients.find(c => c.id === cloned.client_id)
      }
      if (cloned.supplier_id) {
        const suppliers = JSON.parse(localStorage.getItem('taqseet_db_suppliers') || '[]')
        cloned.suppliers = suppliers.find(s => s.id === cloned.supplier_id)
      }
      const installments = JSON.parse(localStorage.getItem('taqseet_db_installments') || '[]')
      cloned.installments = installments.filter(i => i.contract_id === cloned.id)
    }
    return cloned
  }

  // Mutator actions
  async insert(records) {
    const list = this.getData()
    const newRecords = Array.isArray(records) ? records : [records]
    const items = newRecords.map(r => ({
      id: r.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...r
    }))
    list.push(...items)
    localStorage.setItem(`taqseet_db_${this.tableName}`, JSON.stringify(list))

    const res = Array.isArray(records) ? items : items[0]
    return {
      data: res,
      error: null,
      select: () => ({
        single: () => Promise.resolve({ data: res, error: null }),
        maybeSingle: () => Promise.resolve({ data: res, error: null }),
        then: (resolve) => resolve({ data: res, error: null })
      }),
      then: (resolve) => resolve({ data: res, error: null })
    }
  }

  async update(values) {
    const list = this.getData()
    let lastUpdated = null
    const updatedList = list.map(item => {
      let matches = true
      for (const filter of this.filters) {
        if (!filter(item)) {
          matches = false
          break
        }
      }
      if (matches) {
        const updated = {
          ...item,
          ...values,
          updated_at: new Date().toISOString()
        }
        lastUpdated = updated
        return updated
      }
      return item
    })

    localStorage.setItem(`taqseet_db_${this.tableName}`, JSON.stringify(updatedList))

    return {
      data: lastUpdated,
      error: null,
      select: () => ({
        single: () => Promise.resolve({ data: lastUpdated, error: null }),
        maybeSingle: () => Promise.resolve({ data: lastUpdated, error: null }),
        then: (resolve) => resolve({ data: lastUpdated, error: null })
      }),
      then: (resolve) => resolve({ data: lastUpdated, error: null })
    }
  }
}

// Generate complete offline data structure if not configured
function initializeLocalDatabase() {
  if (localStorage.getItem('taqseet_db_initialized')) {
    return
  }

  const SEED_USER = { id: 'demo-user-id', email: 'demo@taqseet.com' }

  const settings = [
    {
      id: 'settings-1',
      user_id: SEED_USER.id,
      business_name: 'محل أبو يوسف للتقسيط',
      owner_name: 'محمد أحمد',
      default_due_day: 1,
      currency: 'EGP',
      currency_symbol: 'ج.م',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
  ]

  const clients = [
    {
      id: 'client-1',
      user_id: SEED_USER.id,
      name: 'أحمد محمود السيد',
      phone: '01012345678',
      national_id: '29901011234567',
      address: 'القاهرة - مدينة نصر - شارع النصر',
      notes: 'عميل منتظم',
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'client-2',
      user_id: SEED_USER.id,
      name: 'فاطمة علي حسن',
      phone: '01098765432',
      national_id: '29805151234568',
      address: 'الجيزة - الدقي - شارع التحرير',
      notes: 'عميلة ملتزمة بالسداد',
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
  ]

  const suppliers = [
    {
      id: 'supplier-1',
      user_id: SEED_USER.id,
      name: 'شركة النور للأجهزة',
      phone: '0223456789',
      company: 'شركة النور للاستيراد والتصدير',
      notes: 'مورد رئيسي للأجهزة الكهربائية',
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
  ]

  const contracts = [
    {
      id: 'contract-1',
      user_id: SEED_USER.id,
      type: 'RECEIVABLE',
      client_id: 'client-1',
      supplier_id: null,
      item_description: 'تلفزيون سامسونج 55 بوصة Smart 4K',
      total_price: 18000,
      down_payment: 3000,
      purchase_price: 12000,
      profit: 6000,
      installment_count: 12,
      installment_amount: 1250,
      start_date: '2024-01-01',
      due_day: 1,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'contract-2',
      user_id: SEED_USER.id,
      type: 'RECEIVABLE',
      client_id: 'client-2',
      supplier_id: null,
      item_description: 'غسالة LG 9 كيلو + تكييف 1.5 حصان',
      total_price: 24000,
      down_payment: 4000,
      purchase_price: 17000,
      profit: 7000,
      installment_count: 10,
      installment_amount: 2000,
      start_date: '2024-03-01',
      due_day: 5,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'contract-3',
      user_id: SEED_USER.id,
      type: 'PAYABLE',
      client_id: null,
      supplier_id: 'supplier-1',
      item_description: 'دفعة أجهزة كهربائية مشتراة (10 تلفزيون + 5 غسالات)',
      total_price: 75000,
      down_payment: 15000,
      purchase_price: 75000,
      profit: 0,
      installment_count: 6,
      installment_amount: 10000,
      start_date: '2024-04-01',
      due_day: 15,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
  ]

  const installments = []
  const payments = []

  const now = new Date()

  const addMonths = (dateStr, n, dueDay) => {
    const d = new Date(dateStr)
    d.setMonth(d.getMonth() + n)
    if (dueDay) {
      d.setDate(Math.min(dueDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    }
    return d
  }

  // Seeding Contract 1 installments (paid/late based on local date context)
  for (let n = 1; n <= 12; n++) {
    const dueDate = addMonths('2024-01-01', n, 1)
    const dueDateStr = dueDate.toISOString().split('T')[0]
    const isPaid = dueDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const instId = `inst-c1-${n}`

    installments.push({
      id: instId,
      user_id: SEED_USER.id,
      contract_id: 'contract-1',
      installment_number: n,
      due_date: dueDateStr,
      amount: 1250,
      remaining_amount: isPaid ? 0 : 1250,
      status: isPaid ? 'paid' : 'pending',
      payment_date: isPaid ? dueDateStr : null,
      payment_method: isPaid ? 'cash' : null,
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })

    if (isPaid) {
      payments.push({
        id: `pay-c1-${n}`,
        user_id: SEED_USER.id,
        installment_id: instId,
        contract_id: 'contract-1',
        amount: 1250,
        payment_date: dueDateStr,
        method: 'cash',
        reference_number: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
      })
    }
  }

  // Seeding Contract 2 installments
  for (let n = 1; n <= 10; n++) {
    const dueDate = addMonths('2024-03-01', n, 5)
    const dueDateStr = dueDate.toISOString().split('T')[0]
    const isPaid = dueDate < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const instId = `inst-c2-${n}`

    installments.push({
      id: instId,
      user_id: SEED_USER.id,
      contract_id: 'contract-2',
      installment_number: n,
      due_date: dueDateStr,
      amount: 2000,
      remaining_amount: isPaid ? 0 : 2000,
      status: isPaid ? 'paid' : 'pending',
      payment_date: isPaid ? dueDateStr : null,
      payment_method: isPaid ? 'transfer' : null,
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })

    if (isPaid) {
      payments.push({
        id: `pay-c2-${n}`,
        user_id: SEED_USER.id,
        installment_id: instId,
        contract_id: 'contract-2',
        amount: 2000,
        payment_date: dueDateStr,
        method: 'transfer',
        reference_number: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
      })
    }
  }

  // Seeding Contract 3 installments
  for (let n = 1; n <= 6; n++) {
    const dueDate = addMonths('2024-04-01', n, 15)
    const dueDateStr = dueDate.toISOString().split('T')[0]
    const isPaid = dueDate < new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
    const instId = `inst-c3-${n}`

    installments.push({
      id: instId,
      user_id: SEED_USER.id,
      contract_id: 'contract-3',
      installment_number: n,
      due_date: dueDateStr,
      amount: 10000,
      remaining_amount: isPaid ? 0 : 10000,
      status: isPaid ? 'paid' : 'pending',
      payment_date: isPaid ? dueDateStr : null,
      payment_method: isPaid ? 'transfer' : null,
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })

    if (isPaid) {
      payments.push({
        id: `pay-c3-${n}`,
        user_id: SEED_USER.id,
        installment_id: instId,
        contract_id: 'contract-3',
        amount: 10000,
        payment_date: dueDateStr,
        method: 'transfer',
        reference_number: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
      })
    }
  }

  localStorage.setItem('taqseet_db_settings', JSON.stringify(settings))
  localStorage.setItem('taqseet_db_clients', JSON.stringify(clients))
  localStorage.setItem('taqseet_db_suppliers', JSON.stringify(suppliers))
  localStorage.setItem('taqseet_db_contracts', JSON.stringify(contracts))
  localStorage.setItem('taqseet_db_installments', JSON.stringify(installments))
  localStorage.setItem('taqseet_db_payments', JSON.stringify(payments))

  const defaultSession = {
    user: SEED_USER,
    access_token: 'demo-token',
    expires_at: Date.now() + 86400000
  }
  localStorage.setItem('taqseet_db_session', JSON.stringify(defaultSession))
  localStorage.setItem('taqseet_db_initialized', 'true')
}

// Reset localStorage data helper
export const resetLocalDatabase = () => {
  localStorage.removeItem('taqseet_db_initialized')
  initializeLocalDatabase()
  window.location.reload()
}

// Instantiate mock supabase client object
const mockSupabase = {
  auth: {
    getSession: async () => {
      initializeLocalDatabase()
      const sessionStr = localStorage.getItem('taqseet_db_session')
      const session = sessionStr ? JSON.parse(sessionStr) : null
      return { data: { session }, error: null }
    },
    getUser: async () => {
      initializeLocalDatabase()
      const sessionStr = localStorage.getItem('taqseet_db_session')
      const session = sessionStr ? JSON.parse(sessionStr) : null
      return { data: { user: session?.user ?? null }, error: null }
    },
    signInWithPassword: async ({ email, password }) => {
      initializeLocalDatabase()
      const user = { id: 'demo-user-id', email }
      const session = { user, access_token: 'demo-token', expires_at: Date.now() + 86400000 }
      localStorage.setItem('taqseet_db_session', JSON.stringify(session))
      authCallbacks.forEach(cb => cb('SIGNED_IN', session))
      return { data: { user, session }, error: null }
    },
    signOut: async () => {
      localStorage.removeItem('taqseet_db_session')
      authCallbacks.forEach(cb => cb('SIGNED_OUT', null))
      return { error: null }
    },
    onAuthStateChange: (callback) => {
      authCallbacks.push(callback)
      // trigger callback with initial session if configured
      const sessionStr = localStorage.getItem('taqseet_db_session')
      const session = sessionStr ? JSON.parse(sessionStr) : null
      setTimeout(() => callback('INITIAL_SESSION', session), 0)

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authCallbacks = authCallbacks.filter(cb => cb !== callback)
            }
          }
        }
      }
    }
  },
  from: (table) => {
    initializeLocalDatabase()
    return new MockQueryBuilder(table)
  }
}

// Export either real client or mock client depending on configuration
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : mockSupabase

export const isSupabaseConfigured = isConfigured

