import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Key, Plus, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  service_name: string;
  api_key: string;
  is_active: boolean;
  usage_count: number;
  error_count: number;
  last_used_at: string | null;
  created_at: string;
}

export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState({
    service: '',
    key: '',
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadApiKeys();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    if (!user?.email) {
      navigate('/');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .single();

      if (error || !data) {
        toast.error('غير مصرح لك بالوصول لهذه الصفحة');
        navigate('/');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'list' },
      });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const statusCode = error.context?.status ?? 500;
            const textContent = await error.context?.text();
            const parsedError = textContent ? JSON.parse(textContent) : null;
            errorMessage = parsedError?.error || textContent || error.message;
            console.error(`[${statusCode}] Load API Keys Error:`, errorMessage);
          } catch {
            errorMessage = error.message;
          }
        }
        throw new Error(errorMessage);
      }
      setApiKeys(data?.data || []);
    } catch (error: any) {
      toast.error(error.message || 'فشل تحميل المفاتيح');
      console.error('Load API Keys Error:', error);
    }
  };

  const handleAddKey = async () => {
    if (!newKey.service || !newKey.key) {
      toast.error('الرجاء إدخال نوع الخدمة والمفتاح');
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          action: 'add',
          service: newKey.service,
          apiKey: newKey.key,
        },
      });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const statusCode = error.context?.status ?? 500;
            const textContent = await error.context?.text();
            const parsedError = textContent ? JSON.parse(textContent) : null;
            errorMessage = parsedError?.error || textContent || error.message;
          } catch {
            errorMessage = error.message;
          }
        }
        throw new Error(errorMessage);
      }

      toast.success('تم إضافة المفتاح بنجاح');
      setNewKey({ service: '', key: '' });
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleKey = async (keyId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          action: 'toggle',
          keyId,
        },
      });

      if (error) throw error;

      toast.success(currentStatus ? 'تم تعطيل المفتاح' : 'تم تفعيل المفتاح');
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المفتاح؟')) return;

    try {
      const { error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          action: 'delete',
          keyId,
        },
      });

      if (error) throw error;

      toast.success('تم حذف المفتاح');
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Header */}
      <header className="border-b border-border/40 glass">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Key className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold gradient-text">لوحة التحكم - API Keys</h1>
                <p className="text-sm text-muted-foreground">إدارة مفاتيح الخدمات الخارجية</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Add New Key */}
        <div className="glass rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">إضافة مفتاح جديد</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">نوع الخدمة</label>
              <select
                className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                value={newKey.service}
                onChange={(e) => setNewKey({ ...newKey, service: e.target.value })}
                disabled={adding}
              >
                <option value="">اختر الخدمة</option>
                <option value="atlascloud">AtlasCloud AI</option>
                <option value="sora2api">Sora2API</option>
                <option value="shotstack">Shotstack</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">مفتاح API</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={newKey.key}
                onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                disabled={adding}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={handleAddKey}
                disabled={adding}
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 ml-2" />
                )}
                إضافة
              </Button>
            </div>
          </div>
        </div>

        {/* Keys List */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">المفاتيح الحالية ({apiKeys.length})</h2>

          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد مفاتيح بعد</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="glass rounded-xl p-4 border border-border/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-lg capitalize">
                          {key.service_name}
                        </span>
                        {key.is_active ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>

                      <div className="font-mono text-sm text-muted-foreground mb-2">
                        {key.api_key.substring(0, 20)}...
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>استخدام: {key.usage_count}</span>
                        <span>أخطاء: {key.error_count}</span>
                        {key.last_used_at && (
                          <span>
                            آخر استخدام:{' '}
                            {new Date(key.last_used_at).toLocaleDateString('ar')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleKey(key.id, key.is_active)}
                      >
                        {key.is_active ? 'تعطيل' : 'تفعيل'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
