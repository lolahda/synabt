import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Upload, X, Loader2, Film, Sparkles, Image as ImageIcon, Video, Type } from 'lucide-react';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

export function CreateProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCharacterImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setCharacterImage(null);
    setImagePreview(null);
  };

  const handleCreateProject = async () => {
    if (!title.trim() || !script.trim()) {
      toast.error('الرجاء إدخال عنوان ونص السيناريو');
      return;
    }

    setLoading(true);
    try {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user!.id,
          title: title.trim(),
          script: script.trim(),
          aspect_ratio: aspectRatio,
          status: 'draft',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      let imageUrl: string | undefined;

      if (characterImage) {
        const fileName = `${user!.id}/${project.id}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-images')
          .upload(fileName, characterImage);

        if (uploadError) {
          console.error('Image upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('project-images')
            .getPublicUrl(fileName);

          imageUrl = publicUrl;

          await supabase.from('project_images').insert({
            project_id: project.id,
            user_id: user!.id,
            image_url: publicUrl,
            storage_path: fileName,
          });
        }
      }

      await supabase
        .from('projects')
        .update({ status: 'analyzing' })
        .eq('id', project.id);

      // ✅ الحصول على التوكن وتمريره للـ Function
      const { data, error } = await supabase.functions.invoke('analyze-script', {
        body: {
          projectId: project.id,
          script: script.trim(),
          characterImage: imageUrl,
        },
      });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const statusCode = error.context?.status ?? 500;
            const textContent = await error.context?.text();
            errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
          } catch {
            errorMessage = `${error.message || 'Failed to analyze script'}`;
          }
        }
        throw new Error(errorMessage);
      }

      toast.success('تم إنشاء المشروع وتحليل السيناريو بنجاح');
      navigate(`/project/${project.id}`);
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 glass sticky top-0 z-10 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base font-bold gradient-text">إنشاء مشروع جديد</h1>
              <p className="text-[10px] text-muted-foreground">أدخل البيانات وابدأ الإنتاج</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 max-w-4xl">
        <div className="space-y-4">
          {/* Project Title */}
          <div className="glass rounded-xl p-3.5 transition-all hover:bg-white/[0.06]">
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-primary" />
              <span>عنوان المشروع</span>
            </label>
            <Input
              placeholder="أدخل عنواناً وصفياً للمشروع"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              className="h-9 text-sm"
            />
          </div>

          {/* Script Editor */}
          <div className="glass rounded-xl p-3.5 transition-all hover:bg-white/[0.06]">
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-primary" />
              <span>نص السيناريو</span>
            </label>
            <Textarea
              placeholder="اكتب السيناريو هنا... سيتم تحليله تلقائياً وتقسيمه إلى مشاهد (كل مشهد ~10 ثوانٍ)"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={10}
              className="resize-none text-sm leading-relaxed"
              disabled={loading}
            />
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Sparkles className="w-3 h-3" />
              <span>يدعم جميع اللغات • تحليل ذكي • تقسيم تلقائي</span>
            </div>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aspect Ratio */}
            <div className="glass rounded-xl p-3.5 transition-all hover:bg-white/[0.06]">
              <label className="block text-sm font-medium mb-2.5 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-primary" />
                <span>أبعاد الفيديو</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  disabled={loading}
                  className={`group p-2.5 rounded-lg border-2 transition-all ${
                    aspectRatio === '16:9'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  } disabled:opacity-50`}
                >
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-md mb-1.5"></div>
                  <div className="text-xs font-medium">أفقي</div>
                  <div className="text-[10px] text-muted-foreground">16:9</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  disabled={loading}
                  className={`group p-2.5 rounded-lg border-2 transition-all ${
                    aspectRatio === '9:16'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  } disabled:opacity-50`}
                >
                  <div className="aspect-[9/16] bg-gradient-to-br from-primary/20 to-primary/5 rounded-md mb-1.5 mx-auto max-w-[50px]"></div>
                  <div className="text-xs font-medium">رأسي</div>
                  <div className="text-[10px] text-muted-foreground">9:16</div>
                </button>
              </div>
            </div>

            {/* Character Image */}
            <div className="glass rounded-xl p-3.5 transition-all hover:bg-white/[0.06]">
              <label className="block text-sm font-medium mb-2.5 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                <span>صورة الشخصية</span>
                <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
              </label>
              
              {imagePreview ? (
                <div className="relative group">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full aspect-square object-cover rounded-lg border border-border"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveImage}
                    disabled={loading}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group">
                  <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors mb-1.5" />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">اختر صورة</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">لثبات الشخصية</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                    disabled={loading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              size="lg"
              className="w-full glow h-11 text-sm"
              onClick={handleCreateProject}
              disabled={loading || !title.trim() || !script.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري التحليل والإنشاء...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 ml-2" />
                  إنشاء المشروع وتحليل السيناريو
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
