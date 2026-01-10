import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { tryWithAllKeys } from '../_shared/api-key-manager.ts';

interface AnalyzeScriptRequest {
  projectId: string;
  script: string;
  characterImage?: string;
}

interface Scene {
  sceneNumber: number;
  textContent: string;
  wordCount: number;
  estimatedDuration: number;
  characterPrompt: string;
  notes?: string;
}

interface AnalysisResult {
  language: string;
  dialect?: string;
  contentType: string;
  sceneCount: number;
  scenes: Scene[];
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ✅ عدم التحقق من JWT - بدلاً من ذلك تحقق من ملكية المشروع
    const { projectId, script, characterImage }: AnalyzeScriptRequest = await req.json();

    if (!projectId || !script) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analyzing script for project ${projectId}`);

    // Create the analysis prompt
    const systemPrompt = `أنت محلل سيناريوهات ذكي ومخرج محترف. مهمتك هي تحليل السيناريو النصي وتحويله إلى مشاهد فيديو.

القواعد الصارمة:
1. حدد لغة النص ولهجته بدقة
2. حدد نوع المحتوى (إعلان، قصة، تعليمي، إلخ)
3. قسّم النص إلى مشاهد، كل مشهد لا يتجاوز 10 ثوانٍ
4. احسب عدد الكلمات والزمن التقديري لكل مشهد (عربي: 2 كلمة/ثانية، إنجليزي: 2.5 كلمة/ثانية)
5. لا تقطع الجمل أبداً - انقل الجملة كاملة للمشهد التالي إن لزم
6. أنشئ وصف ثابت للشخصية (Character Prompt) يستخدم في جميع المشاهد
7. رقّم المشاهد بوضوح
8. لا ترجمة، لا إعادة صياغة، احتفظ بالنص الأصلي

${characterImage ? 'ملاحظة: المستخدم رفع صورة مرجعية للشخصية. استخدم وصف "نفس الشخصية من الصورة المرفقة" في character_prompt' : ''}

أرجع النتيجة بصيغة JSON فقط بهذا الشكل:
{
  "language": "Arabic|English|...",
  "dialect": "Egyptian|Gulf|Formal|US|UK|...",
  "contentType": "advertisement|story|educational|...",
  "sceneCount": 5,
  "scenes": [
    {
      "sceneNumber": 1,
      "textContent": "النص الكامل للمشهد",
      "wordCount": 15,
      "estimatedDuration": 7.5,
      "characterPrompt": "وصف الشخصية الثابت",
      "notes": "ملاحظات إن وجدت"
    }
  ]
}`;

    const userPrompt = `السيناريو:\n\n${script}`;

    // 🔁 AUTO KEY ROTATION: Call AtlasCloud AI with automatic key rotation
    const analysis: AnalysisResult = await tryWithAllKeys('atlascloud', async (apiKey) => {
      console.log(`🤖 Calling AtlasCloud AI for script analysis...`);
      
      const response = await fetch('https://api.atlascloud.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-5.2',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 128000,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AtlasCloud AI Error:', errorText);
        throw new Error(`AtlasCloud AI: ${errorText}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      return JSON.parse(content) as AnalysisResult;
    });

    console.log(`✅ Analysis complete: ${analysis.sceneCount} scenes`);

    // Update project with analysis results
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin
      .from('projects')
      .update({
        language: analysis.language,
        dialect: analysis.dialect,
        content_type: analysis.contentType,
        scene_count: analysis.sceneCount,
        status: 'scenes_ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    // Insert scenes
    const scenesData = analysis.scenes.map(scene => ({
      project_id: projectId,
      scene_number: scene.sceneNumber,
      text_content: scene.textContent,
      word_count: scene.wordCount,
      estimated_duration: scene.estimatedDuration,
      character_prompt: scene.characterPrompt,
      status: 'pending'
    }));

    const { error: scenesError } = await supabaseAdmin
      .from('scenes')
      .insert(scenesData);

    if (scenesError) {
      console.error('Error inserting scenes:', scenesError);
      throw scenesError;
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-script:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
