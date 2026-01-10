import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { tryWithAllKeys } from '../_shared/api-key-manager.ts';

interface CheckMergeStatusRequest {
  projectId: string;
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

    const { projectId }: CheckMergeStatusRequest = await req.json();

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Missing projectId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If already completed, return the video URL
    if (project.status === 'completed' && project.final_video_url && !project.final_video_url.includes('render_')) {
      return new Response(JSON.stringify({ 
        status: 'completed',
        videoUrl: project.final_video_url
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If merging, check Shotstack status
    if (project.status === 'merging' && project.final_video_url) {
      const renderId = project.final_video_url;

      console.log(`Checking merge status for render ${renderId}`);

      // 🔁 AUTO KEY ROTATION: Check Shotstack status with automatic key rotation
      const statusResult = await tryWithAllKeys('shotstack', async (apiKey) => {
        const statusResponse = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
          headers: {
            'x-api-key': apiKey
          }
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error('Shotstack status check error:', errorText);
          throw new Error(`Shotstack: ${errorText}`);
        }

        return await statusResponse.json();
      });
      const renderStatus = statusResult.response.status;
      const renderProgress = statusResult.response.progress || 0;

      console.log(`Render status: ${renderStatus}, progress: ${renderProgress}%`);

      if (renderStatus === 'done') {
        const finalVideoUrl = statusResult.response.url;

        await supabaseAdmin
          .from('projects')
          .update({
            status: 'completed',
            final_video_url: finalVideoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId);

        return new Response(JSON.stringify({ 
          status: 'completed',
          videoUrl: finalVideoUrl
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (renderStatus === 'failed') {
        await supabaseAdmin
          .from('projects')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId);

        return new Response(JSON.stringify({ 
          status: 'failed',
          error: 'Video rendering failed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Still processing
      return new Response(JSON.stringify({ 
        status: renderStatus,
        progress: renderProgress
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unknown state
    return new Response(JSON.stringify({ 
      status: project.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-merge-status:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
