# 🚀 دليل النشر الكامل - حل مشكلة Invalid JWT

## ⚠️ المشكلة الشائعة: `{"code":401,"message":"Invalid JWT"}`

هذه المشكلة تحدث عند النشر على Vercel/Netlify/أي استضافة خارجية بسبب **إعدادات CORS في Supabase**.

---

## ✅ الحل الكامل خطوة بخطوة

### 📋 الخطوة 1: إعداد Supabase (الأهم!)

#### 1.1 إضافة Site URL و Redirect URLs

1. اذهب إلى **Supabase Dashboard**
2. اختر مشروعك → **Authentication** → **URL Configuration**
3. أضف هذه القيم:

```
Site URL:
https://your-app.vercel.app

Additional Redirect URLs (أضف كل سطر منفصل):
http://localhost:5173
http://localhost:5173/**
https://your-app.vercel.app
https://your-app.vercel.app/**
https://your-app.netlify.app
https://your-app.netlify.app/**
https://your-custom-domain.com
https://your-custom-domain.com/**
```

#### 1.2 تفعيل CORS

في نفس صفحة **URL Configuration**:

```
CORS Settings:
*
```

أو إذا كنت تريد أمان أعلى، حدد النطاقات فقط:

```
http://localhost:5173
https://your-app.vercel.app
https://your-app.netlify.app
```

#### 1.3 حفظ التغييرات

⚠️ **مهم جداً:** اضغط **"Save"** في أسفل الصفحة!

---

### 📋 الخطوة 2: إعداد متغيرات البيئة بشكل صحيح

#### للنشر على Vercel:

1. اذهب إلى مشروعك في Vercel
2. **Settings** → **Environment Variables**
3. أضف المتغيرات التالية:

```env
Name: VITE_SUPABASE_URL
Value: https://xxxxx.supabase.co

Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **تحذير:** تأكد أن الأسماء تبدأ بـ `VITE_` بالضبط!

#### للنشر على Netlify:

1. اذهب إلى مشروعك في Netlify
2. **Site settings** → **Build & deploy** → **Environment**
3. أضف نفس المتغيرات أعلاه

---

### 📋 الخطوة 3: إعدادات المشروع

#### 3.1 إنشاء ملف `vercel.json`

في جذر المشروع:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

#### 3.2 إنشاء ملف `netlify.toml`

في جذر المشروع:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

---

### 📋 الخطوة 4: تحديث كود Supabase Client

#### تحديث `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: 'synabt-auth',
  },
  global: {
    headers: {
      'X-Client-Info': 'synabt-web-app',
    },
  },
});

// 🔍 Debug في وضع التطوير
if (import.meta.env.DEV) {
  console.log('Supabase Config:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
  });
}
```

---

### 📋 الخطوة 5: تحديث AuthProvider (مهم جداً!)

#### تحديث `src/components/auth/AuthProvider.tsx`:

```typescript
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { User } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
}

function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username || 
             user.user_metadata?.full_name || 
             user.email!.split('@')[0],
    avatar: user.user_metadata?.avatar_url || 
            user.user_metadata?.picture,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { login, logout, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    // 🔍 تحقق من الجلسة الحالية
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
      }
      
      if (mounted) {
        if (session?.user) {
          console.log('✅ Session found:', session.user.email);
          login(mapSupabaseUser(session.user));
        } else {
          console.log('❌ No active session');
        }
        setLoading(false);
      }
    });

    // 🔄 استماع لتغييرات حالة المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔔 Auth event:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in:', session.user.email);
          login(mapSupabaseUser(session.user));
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
          logout();
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 Token refreshed');
          login(mapSupabaseUser(session.user));
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('👤 User updated');
          login(mapSupabaseUser(session.user));
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [login, logout, setLoading]);

  return <>{children}</>;
}
```

---

### 📋 الخطوة 6: النشر على Vercel

#### الطريقة 1: من خلال GitHub (الأفضل)

```bash
# 1. ارفع الكود لـ GitHub
git add .
git commit -m "Add production config"
git push origin main

# 2. اذهب إلى vercel.com
# 3. New Project → Import من GitHub
# 4. اختر المشروع
# 5. أضف Environment Variables (من الخطوة 2)
# 6. Deploy
```

#### الطريقة 2: من خلال CLI

```bash
# 1. تثبيت Vercel CLI
npm install -g vercel

# 2. تسجيل الدخول
vercel login

# 3. نشر المشروع
vercel

# 4. إضافة متغيرات البيئة
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# 5. نشر للإنتاج
vercel --prod
```

---

### 📋 الخطوة 7: النشر على Netlify

#### الطريقة 1: من خلال GitHub

```bash
# 1. ارفع الكود لـ GitHub
git add .
git commit -m "Add production config"
git push origin main

# 2. اذهب إلى netlify.com
# 3. New site from Git → GitHub
# 4. اختر المشروع
# 5. Build settings:
#    - Build command: npm run build
#    - Publish directory: dist
# 6. Advanced → New variable:
#    VITE_SUPABASE_URL = https://xxx.supabase.co
#    VITE_SUPABASE_ANON_KEY = eyJ...
# 7. Deploy
```

#### الطريقة 2: من خلال CLI

```bash
# 1. تثبيت Netlify CLI
npm install -g netlify-cli

# 2. تسجيل الدخول
netlify login

# 3. ربط المشروع
netlify init

# 4. إضافة متغيرات البيئة
netlify env:set VITE_SUPABASE_URL "https://xxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJ..."

# 5. نشر
netlify deploy --prod
```

---

### 📋 الخطوة 8: التحقق من النشر

بعد النشر، اتبع هذه الخطوات للتأكد:

#### 8.1 فتح Console في المتصفح

1. افتح الموقع المنشور
2. اضغط `F12` لفتح Developer Tools
3. اذهب لـ **Console**
4. يجب أن ترى:

```
✅ Supabase Config: { url: "https://xxx.supabase.co", hasKey: true }
```

#### 8.2 اختبار تسجيل الدخول

1. سجل دخول جديد
2. في Console يجب أن ترى:

```
🔔 Auth event: SIGNED_IN
✅ User signed in: your@email.com
```

3. إذا رأيت `❌ {"code":401,"message":"Invalid JWT"}`:
   - ✅ تحقق من إضافة النطاق في Supabase → URL Configuration
   - ✅ تحقق من متغيرات البيئة في Vercel/Netlify
   - ✅ امسح Cache وأعد النشر

#### 8.3 اختبار الوظائف

- ✅ إنشاء مشروع جديد
- ✅ تحليل السكريبت
- ✅ توليد فيديو
- ✅ دمج الفيديوهات

---

## 🔧 حل المشاكل الشائعة

### المشكلة 1: `Invalid JWT` بعد تسجيل الدخول

**الحل:**

```bash
# 1. تحقق من Supabase Dashboard
Authentication → URL Configuration → Additional Redirect URLs

# يجب أن يحتوي على:
https://your-app.vercel.app/**

# 2. امسح Cache
Vercel: Deployments → ⋯ → Redeploy
Netlify: Deploys → Trigger deploy → Clear cache and deploy

# 3. امسح localStorage في المتصفح
# F12 → Application → Local Storage → Clear
```

### المشكلة 2: متغيرات البيئة لا تعمل

**الحل:**

```bash
# 1. تأكد من أسماء المتغيرات صحيحة
VITE_SUPABASE_URL  # يجب أن تبدأ بـ VITE_
VITE_SUPABASE_ANON_KEY

# 2. في Vercel/Netlify:
# احذف المتغيرات القديمة
# أضف مرة أخرى بدون مسافات أو أسطر جديدة
# Redeploy

# 3. تحقق من القيم:
# اذهب لـ Supabase → Settings → API
# انسخ القيم مرة أخرى
```

### المشكلة 3: الصفحة تظهر 404 عند التنقل

**الحل:**

```bash
# تأكد من وجود أحد هذين الملفين:

# vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}

# أو netlify.toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### المشكلة 4: Session تنتهي بسرعة

**الحل:**

تحديث `src/lib/supabase.ts`:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage, // ⚠️ تأكد من هذا
  },
});
```

---

## 📊 قائمة التحقق النهائية

قبل النشر، تأكد من:

- [ ] ✅ إضافة النطاق في Supabase URL Configuration
- [ ] ✅ تفعيل CORS في Supabase
- [ ] ✅ إضافة متغيرات البيئة في Vercel/Netlify
- [ ] ✅ إنشاء `vercel.json` أو `netlify.toml`
- [ ] ✅ تحديث `AuthProvider.tsx` بالكود الجديد
- [ ] ✅ تحديث `supabase.ts` بالإعدادات الصحيحة
- [ ] ✅ رفع الكود لـ Git
- [ ] ✅ نشر على Vercel/Netlify
- [ ] ✅ اختبار تسجيل الدخول
- [ ] ✅ اختبار جميع الوظائف

---

## 🚀 الخطوات السريعة (TL;DR)

```bash
# 1. Supabase Dashboard
Authentication → URL Configuration → أضف:
https://your-app.vercel.app
https://your-app.vercel.app/**

# 2. أنشئ vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}

# 3. ارفع لـ Git
git add .
git commit -m "Production ready"
git push

# 4. Vercel/Netlify
- Import من GitHub
- أضف Environment Variables:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
- Deploy

# 5. اختبر
- افتح الموقع
- سجل دخول
- يجب أن يعمل بدون أخطاء!
```

---

## 📞 إذا استمرت المشكلة

إذا استمر ظهور `Invalid JWT` بعد اتباع جميع الخطوات:

1. **امسح كل شيء وابدأ من جديد:**

```bash
# في Vercel/Netlify
- احذف المشروع بالكامل
- أنشئ مشروع جديد
- اتبع الخطوات أعلاه بالترتيب

# في Supabase
- اذهب لـ URL Configuration
- احذف جميع الـ Redirect URLs
- أضفها مرة أخرى واحدة تلو الأخرى
- احفظ
```

2. **تحقق من Logs:**

```bash
# Vercel
Functions → Select function → Logs

# Netlify
Deploys → Select deploy → Deploy log

# ابحث عن:
- "Invalid JWT"
- "CORS"
- "401"
```

3. **جرب في Incognito Mode:**

```bash
# افتح المتصفح في وضع التخفي
# سجل دخول مرة أخرى
# إذا عمل → المشكلة في Cache المتصفح
```

---

## ✅ النتيجة المتوقعة

بعد اتباع هذا الدليل:

- ✅ تسجيل الدخول يعمل بدون `Invalid JWT`
- ✅ Session يستمر حتى بعد إعادة تحميل الصفحة
- ✅ جميع الوظائف تعمل مثل OnSpace تماماً
- ✅ يمكن الوصول من أي جهاز ومتصفح
- ✅ يعمل على Vercel, Netlify, أو أي استضافة أخرى

**🎉 الآن مشروعك منشور ويعمل بشكل مثالي!**
