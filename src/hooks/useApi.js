import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isLate } from '@/lib/utils'
import { parseISO } from 'date-fns'

const checkSafeBalance = async (requiredAmount) => {
  // Safe is disabled by user request. Always allow transaction.
  return true
}


// ===================================================
// DASHBOARD
// ===================================================
export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Get all installments with contract info
      const { data: installments, error } = await supabase
        .from('installments')
        .select(`
          *,
          contracts (
            id, type, item_description, status,
            clients (id, name, phone),
            suppliers (id, name, phone)
          )
        `)
        .neq('status', 'paid')
        .order('due_date', { ascending: true })

      if (error) throw error

      // Auto-mark late installments
      const lateInstallments = installments.filter(i =>
        i.status === 'pending' && isLate(i.due_date)
      )

      // Update late ones in background
      if (lateInstallments.length > 0) {
        await supabase
          .from('installments')
          .update({ status: 'late' })
          .in('id', lateInstallments.map(i => i.id))
      }

      const allInstallments = installments.map(i => ({
        ...i,
        status: (i.status === 'pending' && isLate(i.due_date)) ? 'late' : i.status
      }))

      // Summary calculations
      const receivables = allInstallments.filter(i => i.contracts?.type === 'RECEIVABLE')
      const payables = allInstallments.filter(i => i.contracts?.type === 'PAYABLE')

      const totalReceivables = receivables.reduce((sum, i) => sum + parseFloat(i.remaining_amount || 0), 0)
      const totalPayables = payables.reduce((sum, i) => sum + parseFloat(i.remaining_amount || 0), 0)

      const todayInstallments = allInstallments.filter(i => i.due_date === today)
      const weekInstallments = allInstallments.filter(i =>
        i.due_date > today && i.due_date <= weekLater
      )
      const lateCount = allInstallments.filter(i => i.status === 'late').length

      // Get recent payments
      const { data: recentPayments } = await supabase
        .from('payments')
        .select(`
          *,
          contracts (
            item_description,
            clients (name),
            suppliers (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      // Get all contracts to calculate collection rate
      const { data: allContractsData } = await supabase
        .from('contracts')
        .select('type, total_price')

      const clientContracts = allContractsData?.filter(c => c.type === 'RECEIVABLE') || []
      const totalContractsValue = clientContracts.reduce((sum, c) => sum + parseFloat(c.total_price || 0), 0)
      const totalCollected = Math.max(0, totalContractsValue - totalReceivables)
      const collectionRate = totalContractsValue > 0 ? (totalCollected / totalContractsValue) * 100 : 0

      return {
        totalReceivables,
        totalPayables,
        netCash: totalReceivables - totalPayables,
        todayInstallments,
        weekInstallments,
        lateCount,
        allInstallments,
        recentPayments: recentPayments || [],
        totalCollected,
        collectionRate,
      }
    },
  })
}

// ===================================================
// CLIENTS
// ===================================================
export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          contracts (
            id, status, type, total_price, down_payment, installment_count, installment_amount,
            item_description, start_date,
            installments (id, status, remaining_amount, due_date, amount)
          )
        `)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data
    },
  })
}

export const useClient = (id) => {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          contracts (
            *,
            installments (
              *,
              payments (*)
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export const useCreateClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: result, error } = await supabase
        .from('clients')
        .insert({ ...data, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useUpdateClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { data: result, error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useDeleteClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ===================================================
// SUPPLIERS
// ===================================================
export const useSuppliers = () => {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          *,
          contracts (
            id, status, type, total_price, installment_amount,
            item_description, start_date,
            installments (id, status, remaining_amount, due_date, amount)
          )
        `)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data
    },
  })
}

export const useSupplier = (id) => {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          *,
          contracts (
            *,
            installments (
              *,
              payments (*)
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export const useCreateSupplier = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: result, error } = await supabase
        .from('suppliers')
        .insert({ ...data, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ===================================================
// CONTRACTS
// ===================================================
export const useContracts = (filters = {}) => {
  return useQuery({
    queryKey: ['contracts', filters],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select(`
          *,
          clients (id, name, phone),
          suppliers (id, name, phone),
          installments (id, status, remaining_amount, due_date, amount)
        `)
        .order('created_at', { ascending: false })

      if (filters.type) query = query.eq('type', filters.type)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.client_id) query = query.eq('client_id', filters.client_id)
      if (filters.supplier_id) query = query.eq('supplier_id', filters.supplier_id)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export const useContract = (id) => {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          clients (id, name, phone, national_id, address),
          suppliers (id, name, phone, company),
          installments (
            *,
            payments (*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      // Sort installments by number
      if (data.installments) {
        data.installments.sort((a, b) => a.installment_number - b.installment_number)
      }

      return data
    },
    enabled: !!id,
  })
}

export const useCreateContract = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contractData, installments }) => {
      const { data: { user } } = await supabase.auth.getUser()

      // Insert contract (including manual purchase_price and profit)
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({ ...contractData, user_id: user.id })
        .select()
        .single()

      if (contractError) throw contractError

      // Insert all installments
      const installmentRecords = installments.map((inst, idx) => ({
        user_id: user.id,
        contract_id: contract.id,
        installment_number: idx + 1,
        due_date: inst.due_date,
        amount: inst.amount,
        remaining_amount: inst.amount,
        status: 'pending',
      }))

      const { error: installError } = await supabase
        .from('installments')
        .insert(installmentRecords)

      if (installError) throw installError

      return contract
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useUpdateContractStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data, error } = await supabase
        .from('contracts')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ===================================================
// INSTALLMENTS
// ===================================================
export const useInstallments = (filters = {}) => {
  return useQuery({
    queryKey: ['installments', filters],
    queryFn: async () => {
      let query = supabase
        .from('installments')
        .select(`
          *,
          contracts (
            id, type, item_description,
            clients (id, name, phone),
            suppliers (id, name, phone)
          ),
          payments (*)
        `)
        .order('due_date', { ascending: true })

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }
      if (filters.contract_id) query = query.eq('contract_id', filters.contract_id)
      if (filters.date_from) query = query.gte('due_date', filters.date_from)
      if (filters.date_to) query = query.lte('due_date', filters.date_to)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

// ===================================================
// PAYMENTS (Record a payment)
// ===================================================
export const useRecordPayment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ installmentId, amount, method, referenceNumber, notes, paymentDate }) => {
      const { data: { user } } = await supabase.auth.getUser()

      // Get current installment
      const { data: installment, error: fetchError } = await supabase
        .from('installments')
        .select('*, contracts(id, type, item_description)')
        .eq('id', installmentId)
        .single()

      if (fetchError) throw fetchError

      const payAmount = parseFloat(amount)
      let extraAmount = payAmount
      const date = paymentDate || new Date().toISOString().split('T')[0]

      // 1. Process current installment
      const currentRemaining = parseFloat(installment.remaining_amount)
      const amountToApplyCurrent = Math.min(extraAmount, currentRemaining)
      const newRemainingCurrent = Math.max(0, currentRemaining - amountToApplyCurrent)
      const isPaidCurrent = newRemainingCurrent === 0
      
      // Update current installment
      const { error: updateCurrentError } = await supabase
        .from('installments')
        .update({
          remaining_amount: newRemainingCurrent,
          status: isPaidCurrent ? 'paid' : 'partial',
          payment_date: isPaidCurrent ? date : installment.payment_date,
          payment_method: isPaidCurrent ? method : installment.payment_method,
        })
        .eq('id', installmentId)
      if (updateCurrentError) throw updateCurrentError

      // Insert payment record for current installment
      const { data: paymentRecord, error: payError } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          installment_id: installmentId,
          contract_id: installment.contract_id,
          amount: amountToApplyCurrent,
          payment_date: date,
          method: method || 'cash',
          reference_number: referenceNumber || null,
          notes: notes || null,
        })
        .select()
        .single()
      if (payError) throw payError

      extraAmount -= amountToApplyCurrent

      // 2. Process subsequent installments if there's leftover cash
      if (extraAmount > 0) {
        // Fetch subsequent unpaid installments for this contract
        const { data: nextInstallments, error: fetchNextError } = await supabase
          .from('installments')
          .select('*')
          .eq('contract_id', installment.contract_id)
          .neq('id', installmentId)
          .neq('status', 'paid')
          .order('installment_number', { ascending: true })

        if (fetchNextError) throw fetchNextError

        for (const inst of nextInstallments) {
          if (extraAmount <= 0) break

          const instRemaining = parseFloat(inst.remaining_amount)
          const amountToApply = Math.min(extraAmount, instRemaining)
          const newRemaining = Math.max(0, instRemaining - amountToApply)
          const isPaid = newRemaining === 0

          // Update this installment
          const { error: updateNextError } = await supabase
            .from('installments')
            .update({
              remaining_amount: newRemaining,
              status: isPaid ? 'paid' : 'partial',
              payment_date: isPaid ? date : inst.payment_date,
              payment_method: isPaid ? method : inst.payment_method,
            })
            .eq('id', inst.id)
          if (updateNextError) throw updateNextError

          // Record payment for this installment
          const { error: payNextError } = await supabase
            .from('payments')
            .insert({
              user_id: user.id,
              installment_id: inst.id,
              contract_id: installment.contract_id,
              amount: amountToApply,
              payment_date: date,
              method: method || 'cash',
              reference_number: referenceNumber || null,
              notes: notes ? `دفع مقدم فائض: ${notes}` : 'دفع مقدم فائض',
            })
          if (payNextError) throw payNextError

          extraAmount -= amountToApply
        }
      }

      // Check if all installments of the contract are now paid
      const { data: allContractInstallments, error: fetchAllError } = await supabase
        .from('installments')
        .select('status')
        .eq('contract_id', installment.contract_id)

      if (!fetchAllError && allContractInstallments.every(i => i.status === 'paid')) {
        await supabase
          .from('contracts')
          .update({ status: 'completed' })
          .eq('id', installment.contract_id)
      }

      return { success: true, isPaid: isPaidCurrent, newRemaining: newRemainingCurrent }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['installments'] })
    },
  })
}

// ===================================================
// CALENDAR
// ===================================================
export const useCalendar = (year, month) => {
  return useQuery({
    queryKey: ['calendar', year, month],
    queryFn: async () => {
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

      const { data, error } = await supabase
        .from('installments')
        .select(`
          id, due_date, status, amount, remaining_amount,
          contracts (
            id, type, item_description,
            clients (id, name),
            suppliers (id, name)
          )
        `)
        .gte('due_date', from)
        .lte('due_date', to)
        .order('due_date')

      if (error) throw error

      // Group by date
      const byDate = {}
      data.forEach(inst => {
        if (!byDate[inst.due_date]) byDate[inst.due_date] = []
        byDate[inst.due_date].push(inst)
      })

      return byDate
    },
  })
}

// ===================================================
// SETTINGS
// ===================================================
export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        // Create default settings
        const { data: newSettings, error: createError } = await supabase
          .from('settings')
          .insert({ user_id: user.id })
          .select()
          .single()
        if (createError) throw createError
        return newSettings
      }

      return data
    },
  })
}

export const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { data: result, error } = await supabase
        .from('settings')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ===================================================
// REPORTS
// ===================================================
export const useReport = (type, params = {}) => {
  return useQuery({
    queryKey: ['reports', type, params],
    queryFn: async () => {
      if (type === 'cashflow') {
        const { year, month } = params
        const from = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

        const { data, error } = await supabase
          .from('installments')
          .select(`
            *,
            contracts (type, item_description, clients(name), suppliers(name))
          `)
          .gte('due_date', from)
          .lte('due_date', to)
          .order('due_date')

        if (error) throw error

        const receivables = data.filter(i => i.contracts?.type === 'RECEIVABLE')
        const payables = data.filter(i => i.contracts?.type === 'PAYABLE')

        return {
          receivables,
          payables,
          expectedReceivables: receivables.reduce((s, i) => s + parseFloat(i.amount), 0),
          expectedPayables: payables.reduce((s, i) => s + parseFloat(i.amount), 0),
          actualReceivables: receivables
            .filter(i => i.status === 'paid' || i.status === 'partial')
            .reduce((s, i) => s + (parseFloat(i.amount) - parseFloat(i.remaining_amount)), 0),
          actualPayables: payables
            .filter(i => i.status === 'paid' || i.status === 'partial')
            .reduce((s, i) => s + (parseFloat(i.amount) - parseFloat(i.remaining_amount)), 0),
        }
      }

      if (type === 'aging') {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('installments')
          .select(`
            *,
            contracts (type, item_description, clients(name), suppliers(name))
          `)
          .in('status', ['pending', 'partial', 'late'])
          .lt('due_date', today)
          .order('due_date')

        if (error) throw error

        const buckets = { '1-30': [], '31-60': [], '61-90': [], '90+': [] }
        data.forEach(i => {
          const days = Math.floor((new Date() - new Date(i.due_date)) / (1000 * 60 * 60 * 24))
          if (days <= 30) buckets['1-30'].push({ ...i, daysOverdue: days })
          else if (days <= 60) buckets['31-60'].push({ ...i, daysOverdue: days })
          else if (days <= 90) buckets['61-90'].push({ ...i, daysOverdue: days })
          else buckets['90+'].push({ ...i, daysOverdue: days })
        })

        return buckets
      }

      return null
    },
    enabled: !!type,
  })
}

// ===================================================
// PRODUCTS & INVENTORY
// ===================================================
export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productData, purchaseMethod, supplierId, downPayment, installmentCount }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const totalPurchasePrice = (parseFloat(productData.purchase_price) || 0) * (parseInt(productData.stock) || 0)

      // Enforce safe balance check
      if (purchaseMethod === 'cash' && totalPurchasePrice > 0) {
        await checkSafeBalance(totalPurchasePrice)
      } else if (purchaseMethod === 'credit' && totalPurchasePrice > 0 && supplierId) {
        const dp = parseFloat(downPayment || 0)
        if (dp > 0) {
          await checkSafeBalance(dp)
        }
      }

      // 1. Create product in products table
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name: productData.name,
          sku: productData.sku || null,
          purchase_price: parseFloat(productData.purchase_price) || 0,
          cash_price: parseFloat(productData.cash_price) || 0,
          installment_price: parseFloat(productData.installment_price) || 0,
          stock: parseInt(productData.stock) || 0
        })
        .select()
        .single()

      if (productError) throw productError

      // 2. Handle accounting
      if (purchaseMethod === 'cash' && totalPurchasePrice > 0) {
        // Record immediate cash withdrawal from safe
        const { error: safeError } = await supabase
          .from('safe_transactions')
          .insert({
            user_id: user.id,
            type: 'withdrawal',
            amount: totalPurchasePrice,
            category: 'manual_withdrawal',
            notes: `شراء بضاعة نقداً للمخزن: ${product.name} (عدد ${product.stock} وحدات)`,
            transaction_date: new Date().toISOString().split('T')[0]
          })
        if (safeError) throw safeError
      } else if (purchaseMethod === 'credit' && totalPurchasePrice > 0 && supplierId) {
        // Create a PAYABLE contract for supplier
        const dp = parseFloat(downPayment || 0)
        const rem = totalPurchasePrice - dp
        const instCount = parseInt(installmentCount || 1)
        const instAmount = rem / instCount
        const startDate = new Date().toISOString().split('T')[0]

        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .insert({
            user_id: user.id,
            type: 'PAYABLE',
            supplier_id: supplierId,
            product_id: product.id,
            item_description: `شراء بضاعة بالآجل: ${product.name} (عدد ${product.stock} وحدات)`,
            total_price: totalPurchasePrice,
            down_payment: dp,
            installment_count: instCount,
            installment_amount: instAmount,
            start_date: startDate,
            due_day: 1,
            status: 'active'
          })
          .select()
          .single()

        if (contractError) throw contractError

        // Record down payment in safe as withdrawal if dp > 0
        if (dp > 0) {
          const { error: safeError } = await supabase
            .from('safe_transactions')
            .insert({
              user_id: user.id,
              type: 'withdrawal',
              amount: dp,
              category: 'contract_downpayment',
              contract_id: contract.id,
              transaction_date: startDate,
              notes: `مقدم عقد بضاعة آجل للمخزن: ${contract.item_description}`
            })
          if (safeError) throw safeError
        }

        // Generate installments
        const installmentRecords = Array.from({ length: instCount }).map((_, idx) => {
          const dateObj = new Date()
          dateObj.setMonth(dateObj.getMonth() + idx + 1)
          dateObj.setDate(1) // due_day = 1

          return {
            user_id: user.id,
            contract_id: contract.id,
            installment_number: idx + 1,
            due_date: dateObj.toISOString().split('T')[0],
            amount: instAmount,
            remaining_amount: instAmount,
            status: 'pending'
          }
        })

        const { error: instError } = await supabase
          .from('installments')
          .insert(installmentRecords)

        if (instError) throw instError
      }

      return product
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['safe_transactions'] })
      queryClient.invalidateQueries({ queryKey: ['safe_summary'] })
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { data: result, error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

// ===================================================
// SAFE & EXPENSES
// ===================================================
export const useSafeTransactions = (filters = {}) => {
  return useQuery({
    queryKey: ['safe_transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('safe_transactions')
        .select(`
          *,
          payments (
            id,
            installment_id,
            installments (
              installment_number,
              contracts (
                item_description,
                clients (name),
                suppliers (name)
              )
            )
          ),
          contracts (
            id,
            item_description,
            clients (name),
            suppliers (name)
          ),
          expenses (
            id,
            title,
            category
          )
        `)
        .order('created_at', { ascending: false })

      if (filters.type) query = query.eq('type', filters.type)
      if (filters.category) query = query.eq('category', filters.category)
      if (filters.date_from) query = query.gte('transaction_date', filters.date_from)
      if (filters.date_to) query = query.lte('transaction_date', filters.date_to)

      const { data, error } = await query
      if (error) throw error
      return data
    }
  })
}

export const useSafeSummary = () => {
  return useQuery({
    queryKey: ['safe_summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safe_transactions')
        .select('type, amount')

      if (error) throw error

      let totalDeposits = 0
      let totalWithdrawals = 0

      data?.forEach(t => {
        const amt = parseFloat(t.amount || 0)
        if (t.type === 'deposit') {
          totalDeposits += amt
        } else if (t.type === 'withdrawal') {
          totalWithdrawals += amt
        }
      })

      return {
        balance: totalDeposits - totalWithdrawals,
        totalDeposits,
        totalWithdrawals
      }
    }
  })
}

export const useCreateManualSafeTransaction = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ type, amount, category, notes, transaction_date }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const amt = parseFloat(amount)

      // Enforce safe balance check for manual withdrawals
      if (type === 'withdrawal') {
        await checkSafeBalance(amt)
      }

      const { data, error } = await supabase
        .from('safe_transactions')
        .insert({
          user_id: user.id,
          type,
          amount: amt,
          category,
          notes: notes || null,
          transaction_date: transaction_date || new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safe_transactions'] })
      queryClient.invalidateQueries({ queryKey: ['safe_summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })
}

export const useExpenses = (filters = {}) => {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })

      if (filters.category) query = query.eq('category', filters.category)
      if (filters.date_from) query = query.gte('expense_date', filters.date_from)
      if (filters.date_to) query = query.lte('expense_date', filters.date_to)

      const { data, error } = await query
      if (error) throw error
      return data
    }
  })
}

export const useCreateExpense = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, amount, category, notes, expense_date }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const amt = parseFloat(amount)

      // Enforce safe balance check for expenses
      await checkSafeBalance(amt)

      const date = expense_date || new Date().toISOString().split('T')[0]

      // Insert expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          title,
          amount: amt,
          category,
          notes: notes || null,
          expense_date: date
        })
        .select()
        .single()

      if (expenseError) throw expenseError

      // Insert linked safe transaction
      const { error: safeError } = await supabase
        .from('safe_transactions')
        .insert({
          user_id: user.id,
          type: 'withdrawal',
          amount: amt,
          category: 'expense',
          expense_id: expense.id,
          transaction_date: date,
          notes: `مصروف: ${title}${notes ? ` - ${notes}` : ''}`
        })

      if (safeError) throw safeError

      return expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['safe_transactions'] })
      queryClient.invalidateQueries({ queryKey: ['safe_summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })
}

