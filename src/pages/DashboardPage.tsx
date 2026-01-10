import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Film, Plus, LogOut, Sparkles, Clock, CheckCircle, XCircle, Loader2, Key, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadProjects();
    checkIfAdmin();
  }, []);

  const checkIfAdmin = async () => {
    if (!user?.email) return;

    try {
      const { data } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .single();

      if (data) {
        setIsAdmin(true);
      }
    } catch (error) {
      // Not admin
    }
  };

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error('فشل تحميل المشاريع');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع المشاهد والملفات المرتبطة.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast.success('تم حذف المشروع بنجاح');
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error: any) {
      toast.error('فشل حذف المشروع');
      console.error(error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate('/login');
  };

  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'analyzing':
      case 'generating':
      case 'merging':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: Project['status']) => {
    const statusMap = {
      draft: 'مسودة',
      analyzing: 'جاري التحليل',
      scenes_ready: 'المشاهد جاهزة',
      generating: 'جاري الإنتاج',
      merging: 'جاري الدمج',
      completed: 'مكتمل',
      failed: 'فشل',
    };
    return statusMap[status];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Header */}
      <header className="border-b border-border/40 glass">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Film className="w-8 h-8 text-primary" />
                <Sparkles className="w-4 h-4 text-secondary absolute -top-1 -right-1" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">منصة إنتاج الفيديو</h1>
                <p className="text-sm text-muted-foreground">مرحباً، {user?.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate('/admin')}>
                  <Key className="w-4 h-4 ml-2" />
                  إدارة API
                </Button>
              )}
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Create Project Button */}
        <div className="mb-8">
          <Button
            size="lg"
            onClick={() => navigate('/create')}
            className="w-full sm:w-auto glow"
          >
            <Plus className="w-5 h-5 ml-2" />
            إنشاء مشروع جديد
          </Button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">لا توجد مشاريع بعد</h3>
            <p className="text-muted-foreground mb-6">ابدأ بإنشاء مشروعك الأول</p>
            <Button onClick={() => navigate('/create')}>
              <Plus className="w-4 h-4 ml-2" />
              إنشاء مشروع
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="glass rounded-xl p-6 cursor-pointer glass-hover relative group"
              >
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => handleDeleteProject(project.id, e)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                      {project.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(project.created_at), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </p>
                  </div>
                  {getStatusIcon(project.status)}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {project.script}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {project.scene_count} مشهد
                  </span>
                  <span className={`font-medium ${
                    project.status === 'completed' ? 'text-green-500' :
                    project.status === 'failed' ? 'text-red-500' :
                    'text-primary'
                  }`}>
                    {getStatusText(project.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
