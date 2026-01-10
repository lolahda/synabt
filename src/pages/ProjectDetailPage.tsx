import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Project, Scene } from '@/types';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Play,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Film,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadProject();
    loadScenes();
  }, [id]);

  useEffect(() => {
    if (!project) return;

    if (project.status === 'generating' || project.status === 'merging') {
      const interval = setInterval(() => {
        loadProject();
        loadScenes();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [project?.status]);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error: any) {
      toast.error('فشل تحميل المشروع');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadScenes = async () => {
    try {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', id)
        .order('scene_number', { ascending: true });

      if (error) throw error;
      setScenes(data || []);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleStartGeneration = async () => {
    if (!project) return;

    setGenerating(true);
    try {
      await supabase
        .from('projects')
        .update({ status: 'generating' })
        .eq('id', project.id);

      const { data: projectImages } = await supabase
        .from('project_images')
        .select('image_url')
        .eq('project_id', project.id)
        .limit(1);
      
      const characterImage = projectImages?.[0]?.image_url;

      let successCount = 0;
      let failCount = 0;

      // ✅ الحصول على التوكن مرة واحدة
      const { data: { session } } = await supabase.auth.getSession();

      for (const scene of scenes) {
        if (scene.status === 'pending') {
          const { data, error } = await supabase.functions.invoke('generate-scene', {
            body: {
              sceneId: scene.id,
              prompt: `${scene.character_prompt}. ${scene.text_content}`,
              characterImage: characterImage,
              aspectRatio: project.aspect_ratio || '16:9',
            },
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });

          if (error) {
            let errorMessage = error.message;
            if (error instanceof FunctionsHttpError) {
              try {
                const statusCode = error.context?.status ?? 500;
                const textContent = await error.context?.text();
                errorMessage = `[${statusCode}] ${textContent || error.message}`;
              } catch {
                errorMessage = error.message;
              }
            }
            console.error(`Scene ${scene.scene_number} error:`, errorMessage);
            failCount++;
          } else {
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`بدأ إنتاج ${successCount} مشهد`);
        loadProject();
        startPolling();
      }
      
      if (failCount > 0) {
        toast.error(`فشل بدء ${failCount} مشهد`);
      }
    } catch (error: any) {
      toast.error(error.message);
      console.error('Generation start error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const startPolling = () => {
    const MAX_RETRIES = 3;

    const pollInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data: currentScenes } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', id)
        .order('scene_number', { ascending: true });

      if (!currentScenes) return;

      for (const scene of currentScenes) {
        if (scene.status === 'generating' && scene.sora_prediction_id) {
          await supabase.functions.invoke('check-scene-status', {
            body: { sceneId: scene.id },
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });
        }
      }

      await loadScenes();

      for (const scene of currentScenes) {
        if (scene.status === 'failed' && scene.retry_count < MAX_RETRIES) {
          const { data: projectImages } = await supabase
            .from('project_images')
            .select('image_url')
            .eq('project_id', project!.id)
            .limit(1);
          
          const characterImage = projectImages?.[0]?.image_url;

          await supabase
            .from('scenes')
            .update({ 
              retry_count: scene.retry_count + 1,
              status: 'pending',
              error_message: null
            })
            .eq('id', scene.id);

          const { data: { session } } = await supabase.auth.getSession();

          const { error: retryError } = await supabase.functions.invoke('generate-scene', {
            body: {
              sceneId: scene.id,
              prompt: `${scene.character_prompt}. ${scene.text_content}`,
              characterImage: characterImage,
              aspectRatio: project!.aspect_ratio || '16:9',
            },
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });

          if (!retryError) {
            toast.info(`إعادة محاولة توليد المشهد ${scene.scene_number}...`);
          }
        }
      }

      const completedScenes = currentScenes.filter((s) => s.status === 'completed');
      const failedScenes = currentScenes.filter((s) => s.status === 'failed' && s.retry_count >= MAX_RETRIES);
      const activeScenes = currentScenes.filter((s) => 
        s.status === 'generating' || 
        s.status === 'pending' || 
        (s.status === 'failed' && s.retry_count < MAX_RETRIES)
      );

      if (completedScenes.length === currentScenes.length) {
        clearInterval(pollInterval);
        await loadProject();
        toast.success('اكتملت جميع المشاهد! يمكنك الآن دمج الفيديوهات');
      } else if (activeScenes.length === 0 && failedScenes.length > 0) {
        clearInterval(pollInterval);
        await loadProject();
        toast.error(
          `فشل توليد ${failedScenes.length} مشهد بعد ${MAX_RETRIES} محاولات`,
          { duration: 8000 }
        );
      }
    }, 5000);
  };

  const getSceneStatusIcon = (status: Scene['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'generating':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">المشروع غير موجود</h2>
          <Button onClick={() => navigate('/dashboard')}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  const completedCount = scenes.filter(s => s.status === 'completed').length;
  const allCompleted = scenes.length > 0 && scenes.every(s => s.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 glass sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold gradient-text truncate">{project.title}</h1>
                <p className="text-xs text-muted-foreground">
                  {completedCount}/{scenes.length} مشهد مكتمل
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {project.status === 'scenes_ready' && (
                <Button
                  onClick={handleStartGeneration}
                  disabled={generating}
                  className="glow"
                  size="sm"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 ml-2" />
                  )}
                  بدء الإنتاج
                </Button>
              )}

              {allCompleted && (
                <Button
                  onClick={() => navigate(`/project/${project.id}/merge`)}
                  className="glow"
                  size="sm"
                >
                  <Film className="w-4 h-4 ml-2" />
                  دمج الفيديوهات
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Final Video */}
        {project.status === 'completed' && project.final_video_url && (
          <div className="glass rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                الفيديو النهائي
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(project.final_video_url, '_blank')}
                >
                  <Play className="w-4 h-4 ml-2" />
                  مشاهدة
                </Button>
                <Button size="sm" onClick={() => window.open(project.final_video_url, '_blank')}>
                  <Download className="w-4 h-4 ml-2" />
                  تحميل
                </Button>
              </div>
            </div>
            <video
              src={project.final_video_url}
              controls
              className="w-full rounded-lg border border-border"
            />
          </div>
        )}

        {/* Scenes Grid */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">المشاهد ({scenes.length})</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className="glass rounded-lg p-3 border border-border/40 hover:border-primary/50 transition-all group"
              >
                {/* Scene Number Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                    {scene.scene_number}
                  </div>
                  {getSceneStatusIcon(scene.status)}
                </div>

                {/* Video Preview or Placeholder */}
                {scene.video_url ? (
                  <div className="relative aspect-video bg-muted rounded overflow-hidden mb-2">
                    <video
                      src={scene.video_url}
                      className="w-full h-full object-cover"
                      muted
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded flex items-center justify-center mb-2">
                    {scene.status === 'generating' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    ) : (
                      <Film className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                )}

                {/* Scene Info */}
                <p className="text-xs text-foreground/80 line-clamp-2 mb-1">{scene.text_content}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{scene.word_count} كلمة</span>
                  <span>{scene.estimated_duration?.toFixed(1)} ث</span>
                </div>

                {/* Error Message */}
                {scene.status === 'failed' && scene.error_message && (
                  <div className="mt-2 text-[10px] text-red-500 bg-red-500/10 p-1.5 rounded">
                    {scene.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
