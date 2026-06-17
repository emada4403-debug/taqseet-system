-- ===================================================
-- SEED DATA - بيانات تجريبية
-- ===================================================
-- Run this AFTER creating a user account in Supabase Auth
-- Replace 'YOUR_USER_ID' with your actual user UUID from auth.users

-- ===================================================
-- Settings
-- ===================================================
INSERT INTO settings (user_id, business_name, owner_name, default_due_day, currency, currency_symbol)
VALUES (
  auth.uid(),
  'محل أبو يوسف للتقسيط',
  'محمد أحمد',
  1,
  'EGP',
  'ج.م'
) ON CONFLICT DO NOTHING;

-- ===================================================
-- Sample Clients (عملاء تجريبيون)
-- ===================================================
INSERT INTO clients (user_id, name, phone, national_id, address, notes)
VALUES
  (auth.uid(), 'أحمد محمود السيد', '01012345678', '29901011234567', 'القاهرة - مدينة نصر - شارع النصر', 'عميل منتظم'),
  (auth.uid(), 'فاطمة علي حسن', '01098765432', '29805151234568', 'الجيزة - الدقي - شارع التحرير', 'عميلة ملتزمة بالسداد');

-- ===================================================
-- Sample Supplier (مورد تجريبي)
-- ===================================================
INSERT INTO suppliers (user_id, name, phone, company, notes)
VALUES
  (auth.uid(), 'شركة النور للأجهزة', '0223456789', 'شركة النور للاستيراد والتصدير', 'مورد رئيسي للأجهزة الكهربائية');

-- ===================================================
-- Sample Contracts + Auto-generated Installments
-- ===================================================

-- Contract 1: RECEIVABLE - أحمد يشتري تلفزيون
WITH client1 AS (
  SELECT id FROM clients WHERE name = 'أحمد محمود السيد' AND user_id = auth.uid() LIMIT 1
),
contract1 AS (
  INSERT INTO contracts (user_id, type, client_id, item_description, total_price, down_payment, installment_count, installment_amount, start_date, due_day, status)
  SELECT auth.uid(), 'RECEIVABLE', client1.id, 'تلفزيون سامسونج 55 بوصة Smart 4K', 18000, 3000, 12, 1250, '2024-01-01', 1, 'active'
  FROM client1
  RETURNING id, start_date, due_day, installment_count, installment_amount, user_id
)
INSERT INTO installments (user_id, contract_id, installment_number, due_date, amount, remaining_amount, status, payment_date, payment_method)
SELECT
  contract1.user_id,
  contract1.id,
  gs.n,
  (contract1.start_date + (gs.n || ' month')::INTERVAL)::DATE,
  contract1.installment_amount,
  contract1.installment_amount,
  CASE
    WHEN (contract1.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '1 day'
    THEN 'paid'
    WHEN (contract1.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE
    THEN 'late'
    ELSE 'pending'
  END,
  CASE
    WHEN (contract1.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '1 day'
    THEN (contract1.start_date + (gs.n || ' month')::INTERVAL)::DATE
    ELSE NULL
  END,
  CASE
    WHEN (contract1.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '1 day'
    THEN 'cash'
    ELSE NULL
  END
FROM contract1, generate_series(1, contract1.installment_count) AS gs(n);

-- Contract 2: RECEIVABLE - فاطمة تشتري غسالة وتكييف
WITH client2 AS (
  SELECT id FROM clients WHERE name = 'فاطمة علي حسن' AND user_id = auth.uid() LIMIT 1
),
contract2 AS (
  INSERT INTO contracts (user_id, type, client_id, item_description, total_price, down_payment, installment_count, installment_amount, start_date, due_day, status)
  SELECT auth.uid(), 'RECEIVABLE', client2.id, 'غسالة LG 9 كيلو + تكييف 1.5 حصان', 24000, 4000, 10, 2000, '2024-03-01', 5, 'active'
  FROM client2
  RETURNING id, start_date, due_day, installment_count, installment_amount, user_id
)
INSERT INTO installments (user_id, contract_id, installment_number, due_date, amount, remaining_amount, status, payment_date, payment_method)
SELECT
  contract2.user_id,
  contract2.id,
  gs.n,
  (contract2.start_date + (gs.n || ' month')::INTERVAL)::DATE,
  contract2.installment_amount,
  contract2.installment_amount,
  CASE
    WHEN (contract2.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '30 day'
    THEN 'paid'
    WHEN (contract2.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE
    THEN 'late'
    ELSE 'pending'
  END,
  CASE
    WHEN (contract2.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '30 day'
    THEN (contract2.start_date + (gs.n || ' month')::INTERVAL)::DATE
    ELSE NULL
  END,
  CASE
    WHEN (contract2.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '30 day'
    THEN 'transfer'
    ELSE NULL
  END
FROM contract2, generate_series(1, contract2.installment_count) AS gs(n);

-- Contract 3: PAYABLE - المحل يشتري بضاعة من المورد
WITH supplier1 AS (
  SELECT id FROM suppliers WHERE name = 'شركة النور للأجهزة' AND user_id = auth.uid() LIMIT 1
),
contract3 AS (
  INSERT INTO contracts (user_id, type, supplier_id, item_description, total_price, down_payment, installment_count, installment_amount, start_date, due_day, status)
  SELECT auth.uid(), 'PAYABLE', supplier1.id, 'دفعة أجهزة كهربائية مشتراة (10 تلفزيون + 5 غسالات)', 75000, 15000, 6, 10000, '2024-04-01', 15, 'active'
  FROM supplier1
  RETURNING id, start_date, due_day, installment_count, installment_amount, user_id
)
INSERT INTO installments (user_id, contract_id, installment_number, due_date, amount, remaining_amount, status, payment_date, payment_method)
SELECT
  contract3.user_id,
  contract3.id,
  gs.n,
  (contract3.start_date + (gs.n || ' month')::INTERVAL)::DATE,
  contract3.installment_amount,
  contract3.installment_amount,
  CASE
    WHEN (contract3.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '45 day'
    THEN 'paid'
    WHEN (contract3.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE
    THEN 'late'
    ELSE 'pending'
  END,
  CASE
    WHEN (contract3.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '45 day'
    THEN (contract3.start_date + (gs.n || ' month')::INTERVAL)::DATE
    ELSE NULL
  END,
  CASE
    WHEN (contract3.start_date + (gs.n || ' month')::INTERVAL)::DATE < CURRENT_DATE - INTERVAL '45 day'
    THEN 'transfer'
    ELSE NULL
  END
FROM contract3, generate_series(1, contract3.installment_count) AS gs(n);
