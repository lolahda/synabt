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
  Film,
  CheckCircle,
  AlertCircle,
  GripVertical,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

export function MergeVideosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [allScenes, setAllScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [mergeStatus, setMergeStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  // 🎯 Drag & Drop State
  const [uploadedScenes, setUploadedScenes] = useState<Scene[]>([]);
  const [availableScenes, setAvailableScenes] = useState<Scene[]>([]);
  const [draggedScene, setDraggedScene] = useState<Scene | null>(null);
  const [dropZoneActive, setDropZoneActive] = useState(false);

  // 🚀 Quick Upload All Button State
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProject();
    loadScenes();
  }, [id]);

  useEffect(() => {
    if (merging) {
      const interval = setInterval(checkMergeStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [merging]);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProject(data);

      // If already completed, show video
      if (data.status === 'completed' && data.final_video_url && !data.final_video_url.includes('render_')) {
        setFinalVideoUrl(data.final_video_url);
        setMergeStatus('completed');
      } else if (data.status === 'merging') {
        setMerging(true);
        setMergeStatus('merging');
      }
    } catch (error: any) {
      toast.error('فشل تحميل المشروع');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadScenes = async () => {
    try {
      // Load ALL scenes to check status
      const { data: all, error: allError } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', id)
        .order('scene_number', { ascending: true });

      if (allError) throw allError;
      setAllScenes(all || []);

      // Filter completed scenes
      const { data: completed, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', id)
        .eq('status', 'completed')
        .order('scene_number', { ascending: true });

      if (error) throw error;
      setScenes(completed || []);
      
      // 🎯 Initialize available scenes for drag & drop
      setAvailableScenes(completed || []);

      console.log(`📊 Scenes status: ${completed?.length || 0}/${all?.length || 0} completed`);
    } catch (error: any) {
      console.error(error);
    }
  };

  // 🎯 Drag & Drop Handlers
  const handleDragStart = (scene: Scene) => {
    setDraggedScene(scene);
  };

  const handleDragEnd = () => {
    setDraggedScene(null);
    setDropZoneActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropZoneActive(true);
  };

  const handleDragLeave = () => {
    setDropZoneActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropZoneActive(false);

    if (!draggedScene) return;

    // ✅ Check if already uploaded
    if (uploadedScenes.find(s => s.id === draggedScene.id)) {
      toast.error(`المشهد ${draggedScene.scene_number} تم رفعه بالفعل`);
      return;
    }

    // ✅ Add to uploaded scenes
    const newUploadedScenes = [...uploadedScenes, draggedScene];
    setUploadedScenes(newUploadedScenes);

    // ✅ Remove from available scenes
    setAvailableScenes(prev => prev.filter(s => s.id !== draggedScene.id));

    toast.success(`✅ تم رفع المشهد ${draggedScene.scene_number}`);
    setDraggedScene(null);
  };

  const handleRemoveScene = (sceneId: string) => {
    const scene = uploadedScenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Remove from uploaded
    setUploadedScenes(prev => prev.filter(s => s.id !== sceneId));

    // Add back to available
    setAvailableScenes(prev => [...prev, scene].sort((a, b) => a.scene_number - b.scene_number));

    toast.info(`تم إزالة المشهد ${scene.scene_number}`);
  };

  // 🚀 Upload All Scenes Automatically in Order
  const handleUploadAll = () => {
    if (availableScenes.length === 0) {
      toast.info('جميع المشاهد تم رفعها بالفعل');
      return;
    }

    setUploading(true);
    
    // Upload all available scenes in their original order
    const newUploadedScenes = [...uploadedScenes, ...availableScenes]
      .sort((a, b) => a.scene_number - b.scene_number);
    
    setUploadedScenes(newUploadedScenes);
    setAvailableScenes([]);
    
    setTimeout(() => {
      setUploading(false);
      toast.success(`✅ تم رفع ${availableScenes.length} مشهد بالترتيب التلقائي`);
    }, 300);
  };

  // 🔄 Reset All - Clear uploaded scenes
  const handleResetAll = () => {
    const allCompleted = [...uploadedScenes, ...availableScenes]
      .sort((a, b) => a.scene_number - b.scene_number);
    
    setUploadedScenes([]);
    setAvailableScenes(allCompleted);
    toast.info('تم إعادة تعيين جميع المشاهد');
  };

  const handleStartMerge = async () => {
    if (!project) return;

    const totalScenes = project.scene_count;

    // 🚨 CRITICAL CHECK: Verify all scenes uploaded
    if (uploadedScenes.length !== totalScenes) {
      toast.error(
        `يجب رفع جميع المشاهد قبل الدمج\n` +
        `تم رفع: ${uploadedScenes.length}/${totalScenes}`,
        { duration: 4000 }
      );
      return;
    }

    setMerging(true);
    setMergeStatus('starting');

    try {
      // 🎯 Send scenes in the EXACT order they were uploaded
      console.log('🎬 Merging scenes in uploaded order:', uploadedScenes.map(s => s.scene_number));

      const { data, error } = await supabase.functions.invoke('merge-videos', {
        body: { 
          projectId: project.id,
          sceneIds: uploadedScenes.map(s => s.id) // Send scene IDs in upload order
        },
      });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const textContent = await error.context?.text();
            errorMessage = textContent || error.message;
          } catch {
            errorMessage = error.message;
          }
        }
        throw new Error(errorMessage);
      }

      console.log('✅ Merge started:', data);
      console.log(`📹 Merging ${uploadedScenes.length} scenes in order`);
      setMergeStatus('merging');
      toast.success(`بدأ دمج جميع الـ ${uploadedScenes.length} مشهد بالترتيب...`);
    } catch (error: any) {
      toast.error(error.message);
      setMerging(false);
      setMergeStatus('failed');
    }
  };

  const checkMergeStatus = async () => {
    if (!project) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-merge-status', {
        body: { projectId: project.id },
      });

      if (error) {
        console.error('Status check error:', error);
        return;
      }

      console.log('Merge status:', data);

      setMergeStatus(data.status);
      if (data.progress !== undefined) {
        setProgress(data.progress);
      }

      if (data.status === 'completed' && data.videoUrl) {
        setFinalVideoUrl(data.videoUrl);
        setMerging(false);
        toast.success('اكتمل دمج الفيديوهات بنجاح!');
        loadProject();
      } else if (data.status === 'failed') {
        setMerging(false);
        toast.error('فشل دمج الفيديوهات');
      }
    } catch (error: any) {
      console.error('Status check error:', error);
    }
  };

  const getStatusText = () => {
    switch (mergeStatus) {
      case 'starting':
        return 'جاري بدء عملية الدمج...';
      case 'queued':
        return 'في قائمة الانتظار...';
      case 'fetching':
        return 'جاري تحميل المشاهد...';
      case 'rendering':
        return `جاري الدمج... ${progress}%`;
      case 'saving':
        return 'جاري حفظ الفيديو النهائي...';
      case 'done':
      case 'completed':
        return 'اكتمل الدمج!';
      case 'failed':
        return 'فشل الدمج';
      default:
        return mergeStatus;
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
          <Button onClick={() => navigate('/')}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 glass sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold gradient-text">دمج الفيديوهات</h1>
              <p className="text-xs text-muted-foreground">{project.title}</p>
            </div>

            {!merging && !finalVideoUrl && (
              <>
                {availableScenes.length > 0 && (
                  <Button 
                    onClick={handleUploadAll} 
                    variant="outline"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 ml-2" />
                    )}
                    رفع الكل تلقائياً ({availableScenes.length})
                  </Button>
                )}
                {uploadedScenes.length > 0 && uploadedScenes.length !== project?.scene_count && (
                  <Button 
                    onClick={handleResetAll} 
                    variant="ghost"
                  >
                    إعادة تعيين
                  </Button>
                )}
                <Button 
                  onClick={handleStartMerge} 
                  className="glow"
                  disabled={!project || uploadedScenes.length !== project.scene_count}
                >
                  <Film className="w-4 h-4 ml-2" />
                  بدء الدمج {project && `(${uploadedScenes.length}/${project.scene_count})`}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* 🎯 Drag & Drop Interface */}
        {!finalVideoUrl && !merging && project && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Available Scenes */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  المشاهد المولدة ({availableScenes.length})
                </h2>
                {availableScenes.length > 0 && (
                  <Button 
                    size="sm"
                    onClick={handleUploadAll}
                    disabled={uploading}
                    className="text-xs"
                  >
                    {uploading ? (
                      <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3 ml-1" />
                    )}
                    رفع الكل
                  </Button>
                )}
              </div>
              
              {availableScenes.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">
                    ✅ تم رفع جميع المشاهد
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {availableScenes.map((scene) => (
                    <div
                      key={scene.id}
                      draggable
                      onDragStart={() => handleDragStart(scene)}
                      onDragEnd={handleDragEnd}
                      className="glass rounded-lg p-3 border-2 border-border/40 cursor-move hover:border-primary/50 hover:shadow-md hover:shadow-primary/20 transition-all active:scale-95"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs">
                          {scene.scene_number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{scene.text_content}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {scene.estimated_duration?.toFixed(1)} ثانية
                          </p>
                        </div>
                        {scene.video_url && (
                          <video
                            src={scene.video_url}
                            className="w-12 h-12 rounded object-cover"
                            muted
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-[10px] text-center mb-1.5">
                  💡 <strong>طريقتان للرفع:</strong>
                </p>
                <ul className="text-[10px] space-y-0.5 text-muted-foreground">
                  <li>• <strong>يدوياً:</strong> اسحب المشاهد واحداً تلو الآخر بالترتيب المطلوب</li>
                  <li>• <strong>تلقائياً:</strong> اضغط "رفع الكل" لرفع جميع المشاهد بالترتيب الأصلي</li>
                </ul>
              </div>
            </div>

            {/* Drop Zone */}
            <div className="glass rounded-xl p-4">
              <h2 className="text-base font-semibold mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  المشاهد المرفوعة للدمج
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                  uploadedScenes.length === project.scene_count
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-primary/20 text-primary'
                }`}>
                  {uploadedScenes.length} / {project.scene_count}
                </span>
              </h2>

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`min-h-[180px] border-4 border-dashed rounded-lg p-4 transition-all ${
                  dropZoneActive
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : uploadedScenes.length === 0
                    ? 'border-border/50 bg-muted/20'
                    : 'border-green-500/30 bg-green-500/5'
                }`}
              >
                {uploadedScenes.length === 0 ? (
                  <div className="text-center py-8">
                    <Film className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-muted-foreground text-sm">
                      اسحب المشاهد هنا بالترتيب لدمجها
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {uploadedScenes.map((scene, index) => (
                      <div
                        key={scene.id}
                        className="glass rounded-lg p-3 border-2 border-green-500/30 bg-green-500/5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center font-bold text-xs text-green-500">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">مشهد {scene.scene_number}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {scene.text_content}
                            </p>
                          </div>
                          {scene.video_url && (
                            <video
                              src={scene.video_url}
                              className="w-12 h-12 rounded object-cover"
                              muted
                            />
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveScene(scene.id)}
                            className="flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress Indicator */}
              {uploadedScenes.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">التقدم</span>
                    <span className={uploadedScenes.length === project.scene_count ? 'text-green-500 font-semibold' : 'text-primary'}>
                      {uploadedScenes.length === project.scene_count ? '✅ مكتمل' : `${uploadedScenes.length} من ${project.scene_count}`}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        uploadedScenes.length === project.scene_count ? 'bg-green-500' : 'bg-primary'
                      }`}
                      style={{ width: `${(uploadedScenes.length / project.scene_count) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Validation Warning */}
        {!finalVideoUrl && !merging && project && uploadedScenes.length !== project.scene_count && availableScenes.length > 0 && (
          <div className="glass rounded-xl p-4 mb-4 border-2 border-yellow-500/50 bg-yellow-500/10">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-1.5">⚠️ لا يمكن الدمج حالياً</h3>
                <p className="text-sm mb-3">
                  المشاهد المرفوعة للدمج: <span className="font-bold text-green-500">{uploadedScenes.length}</span> من أصل {' '}
                  <span className="font-bold">{project.scene_count}</span>
                </p>
                <p className="text-sm mb-3">
                  المشاهد المتبقية للرفع: <span className="font-bold text-primary">{availableScenes.length}</span>
                </p>
                <div className="text-sm space-y-1">
                  {allScenes.filter(s => s.status === 'generating').length > 0 && (
                    <p>• جاري التوليد: {allScenes.filter(s => s.status === 'generating').length} مشهد</p>
                  )}
                  {allScenes.filter(s => s.status === 'pending').length > 0 && (
                    <p>• في الانتظار: {allScenes.filter(s => s.status === 'pending').length} مشهد</p>
                  )}
                  {allScenes.filter(s => s.status === 'failed').length > 0 && (
                    <p className="text-red-500">• فشل: {allScenes.filter(s => s.status === 'failed').length} مشهد</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  💡 اسحب المشاهد المتبقية من القائمة اليسرى إلى منطقة الدمج اليمنى
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Final Video */}
        {finalVideoUrl && (
          <div className="glass rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                الفيديو النهائي
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(finalVideoUrl, '_blank')}
                >
                  <Play className="w-4 h-4 ml-2" />
                  مشاهدة
                </Button>
                <Button onClick={() => {
                  const link = document.createElement('a');
                  link.href = finalVideoUrl;
                  link.download = `${project.title}.mp4`;
                  link.click();
                }}>
                  <Download className="w-4 h-4 ml-2" />
                  تحميل
                </Button>
              </div>
            </div>
            <video
              src={finalVideoUrl}
              controls
              className="w-full rounded-lg border border-border"
            />
          </div>
        )}

        {/* Merge Status */}
        {merging && !finalVideoUrl && (
          <div className="glass rounded-xl p-6 mb-6 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-1.5">{getStatusText()}</h3>
            {progress > 0 && (
              <div className="max-w-md mx-auto mt-4">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">{progress}%</p>
              </div>
            )}
          </div>
        )}

        {/* Final Order Preview - Only show if all scenes uploaded */}
        {uploadedScenes.length === project?.scene_count && uploadedScenes.length > 0 && !merging && !finalVideoUrl && (
          <div className="glass rounded-xl p-4 mb-6 border-2 border-green-500/30">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-green-500">
              <CheckCircle className="w-4 h-4" />
              ✅ معاينة الترتيب النهائي للدمج
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              سيتم دمج المشاهد بهذا الترتيب الدقيق:
            </p>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {uploadedScenes.map((scene, index) => (
                <div key={scene.id} className="text-center">
                  <div className="relative">
                    {scene.video_url && (
                      <video
                        src={scene.video_url}
                        className="w-full aspect-video rounded border-2 border-green-500/30"
                        muted
                      />
                    )}
                    <div className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {index + 1}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    مشهد {scene.scene_number}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
