import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Film, 
  Sparkles, 
  Clock, 
  Users, 
  Zap, 
  ArrowRight,
  CheckCircle,
  PlayCircle,
  Globe,
  Languages
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Film,
      title: 'إنتاج احترافي',
      description: 'أنشئ أفلام وإعلانات من 10 ثوانٍ إلى ساعة كاملة بجودة سينمائية'
    },
    {
      icon: Users,
      title: 'ثبات الشخصيات',
      description: 'حافظ على نفس الشخصية في جميع المشاهد تلقائياً'
    },
    {
      icon: Clock,
      title: 'سرعة فائقة',
      description: 'من السيناريو إلى الفيديو النهائي في دقائق معدودة'
    },
    {
      icon: Languages,
      title: 'دعم متعدد اللغات',
      description: 'اكتب بأي لغة - عربي، إنجليزي، أو أي لغة أخرى'
    },
    {
      icon: Zap,
      title: 'ذكاء اصطناعي متقدم',
      description: 'تحليل ذكي للنص وتقسيم تلقائي إلى مشاهد متناسقة'
    },
    {
      icon: Globe,
      title: 'سهولة الاستخدام',
      description: 'واجهة بسيطة وسلسة - لا تحتاج خبرة تقنية'
    }
  ];

  const steps = [
    { number: '1', title: 'اكتب السيناريو', description: 'أدخل النص بأي لغة تريد' },
    { number: '2', title: 'التحليل التلقائي', description: 'الذكاء الاصطناعي يقسم النص لمشاهد' },
    { number: '3', title: 'التوليد', description: 'إنتاج الفيديوهات تلقائياً' },
    { number: '4', title: 'الدمج والتحميل', description: 'احصل على الفيديو النهائي جاهز' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Header */}
      <header className="border-b border-border/40 glass sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Film className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Synabt</h1>
                <p className="text-[10px] text-muted-foreground">أول منصة عربية لصناعة الأفلام</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/login')}
                className="hidden md:flex"
              >
                تسجيل الدخول
              </Button>
              <Button 
                onClick={() => navigate('/login')} 
                className="glow"
              >
                ابدأ مجاناً
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">أول منصة عربية لصناعة الأفلام بالذكاء الاصطناعي</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            حوّل أفكارك إلى
            <span className="block gradient-text mt-2">أفلام وإعلانات احترافية</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            من 10 ثوانٍ إلى ساعة كاملة • ثبات كامل للشخصيات • جودة سينمائية
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="glow w-full sm:w-auto text-lg px-8"
              onClick={() => navigate('/login')}
            >
              <PlayCircle className="w-5 h-5 ml-2" />
              ابدأ الإنتاج الآن
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto text-lg px-8"
            >
              شاهد أمثلة
              <ArrowRight className="w-5 h-5 mr-2" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-16">
            <div className="text-center">
              <div className="text-3xl font-bold gradient-text mb-1">10 ث</div>
              <div className="text-sm text-muted-foreground">الحد الأدنى</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold gradient-text mb-1">60 د</div>
              <div className="text-sm text-muted-foreground">الحد الأقصى</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold gradient-text mb-1">100%</div>
              <div className="text-sm text-muted-foreground">ثبات الشخصيات</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">لماذا Synabt؟</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            منصة متكاملة تجمع أحدث تقنيات الذكاء الاصطناعي لصناعة محتوى مرئي احترافي
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="glass rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">كيف تعمل المنصة؟</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            4 خطوات بسيطة من الفكرة إلى الفيديو الجاهز
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="glass rounded-2xl p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 left-full w-full h-0.5 bg-gradient-to-l from-primary/50 to-transparent -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="glass rounded-3xl p-8 md:p-12 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            جاهز لبدء الإنتاج؟
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            انضم لمئات المبدعين الذين يصنعون محتوى احترافي بسهولة
          </p>
          <Button 
            size="lg" 
            className="glow text-lg px-10"
            onClick={() => navigate('/login')}
          >
            <Sparkles className="w-5 h-5 ml-2" />
            ابدأ مشروعك الأول مجاناً
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 glass mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold gradient-text">Synabt</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Synabt. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
