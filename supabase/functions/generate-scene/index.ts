import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { tryWithAllKeys } from '../_shared/api-key-manager.ts';

interface GenerateSceneRequest {
  sceneId: string;
  prompt: string;
  characterImage?: string;
  aspectRatio?: '16:9' | '9:16';
  duration?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sceneId, prompt, characterImage, aspectRatio = '16:9', duration = 4 }: GenerateSceneRequest = await req.json();

    if (!sceneId || !prompt) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating video for scene ${sceneId}`);

    // Prepare Sora2API request (using correct API)
    const requestBody: any = {
      prompt: prompt,
      aspectRatio: aspectRatio === '16:9' ? 'landscape' : 'portrait',
      quality: 'hd'
    };

    if (characterImage) {
      requestBody.imageUrls = [characterImage];
    }

    console.log('🎬 Sending request to Sora2API:', requestBody);

    // 🔁 AUTO KEY ROTATION: Call Sora2API with automatic key rotation
    const taskId = await tryWithAllKeys('sora2api', async (apiKey) => {
      const response = await fetch('https://api.sora2api.ai/api/v1/sora2api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sora2API Error:', errorText);
        throw new Error(`Sora2API: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.code !== 200) {
        console.error('Sora2API returned error:', result);
        throw new Error(result.msg || 'Failed to create video generation task');
      }

      const returnedTaskId = result.data?.taskId;
      
      if (!returnedTaskId) {
        throw new Error('No taskId returned from Sora2API');
      }

      return returnedTaskId;
    });

    console.log(`✅ Task created: ${taskId}`);

    // Update scene with task ID and status
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin
      .from('scenes')
      .update({
        sora_prediction_id: taskId,
        status: 'generating',
        updated_at: new Date().toISOString()
      })
      .eq('id', sceneId);

    console.log(`✅ Scene ${sceneId} updated with taskId ${taskId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      taskId,
      status: 'generating'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-scene:', error);
    
    // Update scene status on final failure
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseAdmin
        .from('scenes')
        .update({
          status: 'failed',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', sceneId);
    } catch (updateError) {
      console.error('Failed to update scene status:', updateError);
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
