import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { mapSupabaseUser } from '@/lib/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { login, logout, setLoading } = useAuth();

  useEffect(() => {
    let mounted = true;

    // 🔍 Safety #1: التحقق من الجلسة الحالية (عند تحميل الصفحة)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Session error:', error.message);
      }

      if (mounted) {
        if (session?.user) {
          console.log('✅ Active session found:', session.user.email);
          login(mapSupabaseUser(session.user));
        } else {
          console.log('ℹ️ No active session');
        }
        setLoading(false);
      }
    });

    // 🔄 Safety #2: الاستماع لتغييرات حالة المصادقة
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔔 Auth event:', event);

      // ✅ تسجيل دخول ناجح
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email);
        login(mapSupabaseUser(session.user));
        setLoading(false);
      }
      
      // 👋 تسجيل خروج
      else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        logout();
        setLoading(false);
      }
      
      // 🔄 تحديث JWT
      else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed for:', session.user.email);
        login(mapSupabaseUser(session.user));
      }
      
      // 👤 تحديث معلومات المستخدم
      else if (event === 'USER_UPDATED' && session?.user) {
        console.log('👤 User updated:', session.user.email);
        login(mapSupabaseUser(session.user));
      }
      
      // ⚠️ خطأ في المصادقة
      else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        console.log('⚠️ Auth cleared:', event);
        logout();
        setLoading(false);
      }
    });

    // 🧹 Cleanup عند إلغاء التثبيت
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [login, logout, setLoading]);

  return <>{children}</>;
}
