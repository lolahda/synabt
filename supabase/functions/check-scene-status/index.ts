import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { tryWithAllKeys } from '../_shared/api-key-manager.ts';

interface CheckStatusRequest {
  sceneId: string;
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

    const { sceneId }: CheckStatusRequest = await req.json();

    if (!sceneId) {
      return new Response(JSON.stringify({ error: 'Missing sceneId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get scene
    const { data: scene, error: sceneError } = await supabaseAdmin
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .single();

    if (sceneError || !scene) {
      return new Response(JSON.stringify({ error: 'Scene not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!scene.sora_prediction_id) {
      return new Response(JSON.stringify({ 
        status: scene.status,
        message: 'No prediction ID found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔁 AUTO KEY ROTATION: Check task status with automatic key rotation
    const taskData = await tryWithAllKeys('sora2api', async (apiKey) => {
      const response = await fetch(
        `https://api.sora2api.ai/api/v1/sora2api/record-info?taskId=${scene.sora_prediction_id}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sora2API Status Check Error:', errorText);
        throw new Error(`Sora2API: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.code !== 200) {
        console.error('Sora2API status check error:', result);
        throw new Error(result.msg || 'Failed to check task status');
      }

      return result.data;
    });
    const successFlag = taskData.successFlag;

    console.log(`Scene ${sceneId} successFlag: ${successFlag}`);

    // successFlag: 0=Generating, 1=Success, 2=Task Creation Failed, 3=Generation Failed
    if (successFlag === 1 && taskData.response?.imageUrl) {
      // Download and upload video to Supabase Storage
      const videoUrl = taskData.response.imageUrl;
      const videoResponse = await fetch(videoUrl);
      const videoBlob = await videoResponse.blob();
      
      const fileName = `${scene.project_id}/${sceneId}.mp4`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('scene-videos')
        .upload(fileName, videoBlob, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('scene-videos')
        .getPublicUrl(fileName);

      await supabaseAdmin
        .from('scenes')
        .update({
          status: 'completed',
          video_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', sceneId);

      return new Response(JSON.stringify({ 
        status: 'completed',
        videoUrl: publicUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (successFlag === 2 || successFlag === 3) {
      // Failed
      const errorMsg = taskData.errorMessage || 'Video generation failed';
      await supabaseAdmin
        .from('scenes')
        .update({
          status: 'failed',
          error_message: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', sceneId);

      return new Response(JSON.stringify({ 
        status: 'failed',
        error: errorMsg
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Still processing (successFlag === 0)
    return new Response(JSON.stringify({ 
      status: 'generating'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-scene-status:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
