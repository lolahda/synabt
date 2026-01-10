import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { mapSupabaseUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Film, Mail, Lock, User, Sparkles } from 'lucide-react';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSendOtp = async () => {
    if (!email) {
      toast.error('الرجاء إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      if (error) throw error;

      toast.success('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
      setStep('otp');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 8) {
      toast.error('الرجاء إدخال رمز التحقق المكون من 8 أرقام');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      // إذا كان تسجيل دخول، ادخل مباشرة
      if (isLogin && data.user) {
        login(mapSupabaseUser(data.user));
        navigate('/');
      } else {
        // إذا كان تسجيل جديد، اذهب لخطوة إدخال البيانات
        setStep('password');
        setLoading(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'رمز التحقق غير صحيح');
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!username || username.trim().length < 3) {
      toast.error('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
      return;
    }

    if (!password || password.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: { username },
      });

      if (error) throw error;
      if (data.user) {
        login(mapSupabaseUser(data.user));
        toast.success('تم إنشاء الحساب بنجاح!');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء إنشاء الحساب');
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      toast.error('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (data.user) {
        login(mapSupabaseUser(data.user));
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
      {/* Floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="relative">
              <Film className="w-12 h-12 text-primary" />
              <Sparkles className="w-6 h-6 text-secondary absolute -top-1 -right-1" />
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            منصة إنتاج الفيديو
          </h1>
          <p className="text-muted-foreground">حوّل أفكارك إلى فيديوهات احترافية</p>
        </div>

        {/* Login/Register Form */}
        <div className="glass rounded-2xl p-8 glow">
          <div className="flex gap-2 mb-6">
            <Button
              variant={isLogin ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => {
                setIsLogin(true);
                setStep('email');
              }}
            >
              تسجيل الدخول
            </Button>
            <Button
              variant={!isLogin ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => {
                setIsLogin(false);
                setStep('email');
              }}
            >
              إنشاء حساب
            </Button>
          </div>

          {step === 'email' && (
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10"
                  disabled={loading}
                />
              </div>

              {isLogin && (
                <>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      disabled={loading}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handlePasswordLogin}
                    disabled={loading}
                  >
                    {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-card px-2 text-muted-foreground">أو</span>
                    </div>
                  </div>
                </>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleSendOtp}
                disabled={loading}
              >
                {isLogin ? 'تسجيل الدخول برمز التحقق' : 'إنشاء حساب برمز التحقق'}
              </Button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  تم إرسال رمز التحقق إلى
                </p>
                <p className="font-medium">{email}</p>
              </div>

              <Input
                type="text"
                placeholder="رمز التحقق (8 أرقام)"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                className="text-center text-2xl tracking-widest"
                disabled={loading}
              />

              <Button
                className="w-full"
                onClick={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? 'جاري التحقق...' : 'تحقق'}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep('email')}
                disabled={loading}
              >
                رجوع
              </Button>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  إكمال إنشاء الحساب
                </p>
              </div>

              <div className="relative">
                <User className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pr-10"
                  disabled={loading}
                />
              </div>

              <div className="relative">
                <Lock className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="كلمة المرور (8 أرقام على الأقل)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  disabled={loading}
                  minLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground">يجب أن تكون كلمة المرور 8 أحرف على الأقل</p>

              <Button
                className="w-full"
                onClick={handleSetPassword}
                disabled={loading}
              >
                {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          بإنشاء حساب، أنت توافق على شروط الاستخدام
        </p>
      </div>
    </div>
  );
}
