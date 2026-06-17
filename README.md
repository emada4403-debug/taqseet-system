# نظام إدارة التقسيط — Installment Credit Management System

<div dir="rtl">

## نظرة عامة

نظام ويب متكامل لإدارة أعمال التقسيط الشخصية. يشمل:

- 📥 **المديونيات**: إدارة العملاء والأقساط المستحقة لك
- 📤 **المستحقات**: إدارة الموردين والأقساط التي عليك
- 📊 **الداشبورد**: ملخص يومي وتنبيهات التأخير
- 📅 **التقويم**: عرض جميع الأقساط بصرياً
- 📈 **التقارير**: تدفق نقدي + تقرير التأخير
- 💬 **واتساب**: توليد رسائل تذكير جاهزة

</div>

---

## 🚀 نشر سريع (Vercel + Supabase)

### 1. إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ حساباً مجانياً
2. أنشئ مشروع جديد
3. في **SQL Editor**، نفّذ ملف `supabase/migrations/001_initial_schema.sql`
4. ثم نفّذ `supabase/migrations/002_seed_data.sql` (بعد تسجيل أول مستخدم)
5. احفظ **Project URL** و**anon public key** من Settings → API

### 2. إنشاء مستخدم في Supabase Auth

في Supabase Dashboard:
- Authentication → Users → Add User
- أدخل البريد الإلكتروني وكلمة المرور

### 3. رفع الكود على GitHub

```bash
git init
git add .
git commit -m "init: نظام إدارة التقسيط"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taqseet-system.git
git push -u origin main
```

### 4. نشر على Vercel

1. اذهب إلى [vercel.com](https://vercel.com) وسجّل دخول بحساب GitHub
2. اضغط **New Project** واختر الـ repository
3. في **Environment Variables** أضف:
   ```
   VITE_SUPABASE_URL = https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJxxx...
   ```
4. اضغط **Deploy** 🎉

---

## 💻 تشغيل محلياً

```bash
# 1. نسخ ملف البيئة
cp .env.example .env

# 2. تعديل .env بإضافة بيانات Supabase
# VITE_SUPABASE_URL=https://your-project-id.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# 3. تثبيت الحزم
npm install

# 4. تشغيل التطوير
npm run dev
# → http://localhost:3000
```

---

## 🗃️ هيكل المشروع

```
src/
├── components/
│   ├── layout/Layout.jsx       # التصميم الرئيسي (sidebar + header)
│   └── ui/
│       ├── Modal.jsx            # نافذة منبثقة
│       ├── PaymentModal.jsx     # تسجيل دفعة
│       ├── InstallmentRow.jsx   # صف قسط
│       └── States.jsx           # حالات التحميل والخطأ
├── context/
│   ├── AuthContext.jsx          # إدارة تسجيل الدخول
│   └── ToastContext.jsx         # رسائل الإشعار
├── hooks/useApi.js              # جميع استدعاءات API
├── lib/
│   ├── supabase.js              # عميل Supabase
│   └── utils.js                 # دوال مساعدة
└── pages/
    ├── Login.jsx               # تسجيل الدخول
    ├── Dashboard.jsx           # الرئيسية
    ├── Receivables.jsx         # المديونيات
    ├── ClientDetail.jsx        # تفاصيل عميل
    ├── Payables.jsx            # المستحقات
    ├── SupplierDetail.jsx      # تفاصيل مورد
    ├── NewContract.jsx         # عقد جديد (3 خطوات)
    ├── Calendar.jsx            # التقويم
    ├── Reports.jsx             # التقارير
    └── Settings.jsx            # الإعدادات
```

---

## 🛠️ التقنيات المستخدمة

| التقنية | الوصف |
|---------|-------|
| React 18 + Vite | واجهة المستخدم |
| Tailwind CSS v3 | التصميم |
| React Router v7 | التنقل |
| TanStack Query v5 | إدارة البيانات |
| Supabase | قاعدة البيانات + Auth |
| jsPDF + autoTable | تصدير PDF |
| SheetJS (xlsx) | تصدير Excel |
| Lucide React | الأيقونات |
| date-fns | معالجة التواريخ |

---

## 📱 المميزات

- ✅ واجهة عربية RTL كاملة
- ✅ دعم الوضع الليلي (Dark Mode)
- ✅ متجاوب مع الهاتف المحمول
- ✅ توليد تلقائي للأقساط عند إنشاء العقد
- ✅ اكتشاف تلقائي للأقساط المتأخرة
- ✅ دعم الدفع الجزئي
- ✅ تصدير PDF وExcel
- ✅ توليد رسائل تذكير واتساب
- ✅ تقويم شهري بصري
- ✅ تقرير التأخير (Aging Report)
- ✅ تقرير التدفق النقدي

---

## 🔒 الأمان

- المصادقة عبر Supabase Auth (JWT)
- Row Level Security (RLS) - كل مستخدم يرى بياناته فقط
- لا يوجد خادم خلفي — كل شيء عبر Supabase API المشفّر

---

صُنع بـ ❤️ لإدارة أعمال التقسيط الشخصية
