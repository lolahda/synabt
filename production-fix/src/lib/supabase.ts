import { createClient } from '@supabase/supabase-js';

// ✅ التحقق من وجود متغيرات البيئة
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '⚠️ Missing Supabase environment variables!\n' +
    'Make sure you have:\n' +
    '- VITE_SUPABASE_URL\n' +
    '- VITE_SUPABASE_ANON_KEY\n' +
    'in your .env file or hosting platform settings.'
  );
}

// ✅ إنشاء Supabase Client مع إعدادات الإنتاج الصحيحة
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // ✅ استخدام PKCE flow للأمان
    flowType: 'pkce',
    
    // ✅ الحفاظ على الجلسة حتى بعد إعادة التحميل
    persistSession: true,
    
    // ✅ تحديث JWT تلقائياً قبل انتهاء صلاحيته
    autoRefreshToken: true,
    
    // ✅ التحقق من الجلسة في الـ URL (للـ OAuth callbacks)
    detectSessionInUrl: true,
    
    // ✅ استخدام localStorage لتخزين الجلسة
    storage: localStorage,
    
    // ✅ مفتاح التخزين (تأكد من تفرده)
    storageKey: 'synabt-auth',
  },
  
  global: {
    headers: {
      // ✅ تحديد هوية التطبيق
      'X-Client-Info': 'synabt-web-app',
    },
  },
  
  // ✅ إعدادات Realtime (اختياري - إذا كنت تستخدم Realtime)
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// 🔍 Debug في وضع التطوير فقط
if (import.meta.env.DEV) {
  console.log('✅ Supabase initialized with config:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    mode: import.meta.env.MODE,
  });
}

// 🔒 عدم عرض المعلومات الحساسة في الإنتاج
if (!import.meta.env.DEV) {
  console.log('✅ Supabase client ready for production');
}
