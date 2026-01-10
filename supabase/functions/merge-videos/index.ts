import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { tryWithAllKeys } from '../_shared/api-key-manager.ts';

interface MergeVideosRequest {
  projectId: string;
  sceneIds?: string[]; // 🎯 Optional: Custom scene order from drag & drop
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

    const { projectId, sceneIds }: MergeVideosRequest = await req.json();

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Missing projectId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Merging videos for project ${projectId}`);
    if (sceneIds) {
      console.log(`🎯 Custom scene order provided: ${sceneIds.length} scenes`);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ⚠️ CRITICAL: Get project to verify total scene count
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('scene_count')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project error:', projectError);
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalScenes = project.scene_count;
    console.log(`🔢 Total scenes in project: ${totalScenes}`);

    // 🔍 CRITICAL: Get ALL scenes (to check status)
    const { data: allScenes, error: allScenesError } = await supabaseAdmin
      .from('scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true });

    if (allScenesError || !allScenes) {
      console.error('Scenes error:', allScenesError);
      return new Response(JSON.stringify({ error: 'Failed to load scenes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 Database query returned ${allScenes.length} total scenes`);

    // 🎯 CUSTOM ORDER: If sceneIds provided, use that order; otherwise use scene_number
    let scenes;
    if (sceneIds && sceneIds.length > 0) {
      console.log('🎯 Using custom drag & drop order');
      console.log('📋 Received sceneIds:', sceneIds);
      
      // 🚨 CRITICAL: Map scenes in EXACT order provided, with validation
      scenes = [];
      const notFoundIds: string[] = [];
      const notCompletedIds: string[] = [];
      
      for (const id of sceneIds) {
        const scene = allScenes.find(s => s.id === id);
        if (!scene) {
          notFoundIds.push(id);
          console.error(`❌ Scene ID not found: ${id}`);
        } else if (scene.status !== 'completed') {
          notCompletedIds.push(id);
          console.error(`❌ Scene ${scene.scene_number} not completed: status=${scene.status}`);
        } else {
          scenes.push(scene);
          console.log(`✅ Added scene ${scene.scene_number} (ID: ${id})`);
        }
      }
      
      // Report any issues
      if (notFoundIds.length > 0) {
        console.error(`❌ ${notFoundIds.length} scene IDs not found in database:`, notFoundIds);
      }
      if (notCompletedIds.length > 0) {
        console.error(`❌ ${notCompletedIds.length} scenes not completed:`, notCompletedIds);
      }
      
      console.log(`🎯 Successfully ordered ${scenes.length}/${sceneIds.length} scenes by drag & drop order`);
    } else {
      console.log('🔢 Using default scene_number order');
      // Use default order (scene_number)
      scenes = allScenes.filter(s => s.status === 'completed');
    }
    const completedCount = scenes.length;

    console.log(`🔍 After filter: ${completedCount} completed scenes`);
    console.log('🔍 Completed scenes:', scenes.map(s => ({
      num: s.scene_number,
      url: s.video_url?.substring(0, 50) + '...'
    })));

    console.log(`✅ Final scenes to merge: ${completedCount}`);
    console.log(`🎬 Scene order for merging:`, scenes.map(s => ({ id: s.id, num: s.scene_number })));
    console.log(`📊 Scene status breakdown:`, {
      total: allScenes.length,
      completed: allScenes.filter(s => s.status === 'completed').length,
      generating: allScenes.filter(s => s.status === 'generating').length,
      failed: allScenes.filter(s => s.status === 'failed').length,
      pending: allScenes.filter(s => s.status === 'pending').length,
    });

    // 🚨 MANDATORY CHECK: All scenes must be completed AND included
    if (completedCount !== totalScenes) {
      const missingScenes = allScenes.filter(s => s.status !== 'completed');
      const missingDetails = missingScenes.map(s => `Scene ${s.scene_number} (${s.status})`);
      
      // 🔍 Additional check: If sceneIds provided, verify all are included
      if (sceneIds && sceneIds.length > 0 && sceneIds.length !== totalScenes) {
        console.error(`❌ sceneIds count mismatch: received ${sceneIds.length}, expected ${totalScenes}`);
        return new Response(JSON.stringify({ 
          error: `Incorrect number of scenes: received ${sceneIds.length}, expected ${totalScenes}`,
          details: `Please ensure ALL ${totalScenes} scenes are uploaded to merge zone`,
          receivedCount: sceneIds.length,
          expectedCount: totalScenes
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.error(`❌ MERGE BLOCKED: Not all scenes completed`);
      console.error(`Missing/Failed scenes:`, missingDetails);
      
      return new Response(JSON.stringify({ 
        error: `Cannot merge: ${completedCount}/${totalScenes} scenes completed`,
        details: `Missing scenes: ${missingDetails.join(', ')}`,
        completedCount,
        totalScenes,
        missingScenes: missingDetails
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔢 VERIFY: Count matches
    if (scenes.length !== totalScenes) {
      console.error(`❌ COUNT MISMATCH: ${scenes.length} completed vs ${totalScenes} total`);
      return new Response(JSON.stringify({ 
        error: `Data integrity error: Scene count mismatch (${scenes.length} vs ${totalScenes})`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ All scenes validated. Proceeding with merge...');
    console.log('🎬 FINAL SCENES TO MERGE:', scenes.map(s => ({ 
      num: s.scene_number, 
      url: s.video_url, 
      duration: s.estimated_duration 
    })));

    if (scenes.length === 0) {
      return new Response(JSON.stringify({ error: 'No completed scenes found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🚨 CRITICAL: Validate all scenes have video URLs
    const missingUrls = scenes.filter(s => !s.video_url || s.video_url.trim() === '');
    if (missingUrls.length > 0) {
      console.error('❌ Scenes missing video URLs:', missingUrls.map(s => ({
        num: s.scene_number,
        id: s.id,
        url: s.video_url
      })));
      return new Response(JSON.stringify({ 
        error: `Scenes ${missingUrls.map(s => s.scene_number).join(', ')} are missing video URLs`,
        missingScenes: missingUrls.map(s => s.scene_number)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ All scenes have valid video URLs');

    // 🎬 USE FIXED DURATION: All videos are 10 seconds
    console.log('\n🎬 ========== VIDEO DURATIONS ==========');
    console.log(`🎬 All generated videos are 10 seconds each`);
    console.log(`🎬 Total scenes: ${scenes.length}`);
    console.log(`🎬 Total expected duration: ${scenes.length * 10} seconds`);
    
    const FIXED_DURATION = 10; // All Sora2API videos are 10 seconds

    // 🎬 Prepare Shotstack timeline with FIXED DURATION
    console.log('\n🎬 ========== BUILDING CLIPS ARRAY ==========');
    console.log(`🎬 Total scenes to process: ${scenes.length}`);
    console.log(`🎬 Expected total scenes: ${totalScenes}`);
    
    const clips = scenes.map((scene, index) => {
      const startTime = index * FIXED_DURATION; // Each video starts after previous one
      
      console.log(`📹 [${index + 1}/${scenes.length}] Scene #${scene.scene_number}:`);
      console.log(`   - Video URL: ${scene.video_url}`);
      console.log(`   - Start: ${startTime}s`);
      console.log(`   - Length: ${FIXED_DURATION}s`);
      console.log(`   - End: ${startTime + FIXED_DURATION}s`);
      
      return {
        asset: {
          type: 'video',
          src: scene.video_url
        },
        start: startTime,
        length: FIXED_DURATION,
        fit: 'crop',
        scale: 1
      };
    });
    
    const totalDuration = scenes.length * FIXED_DURATION;
    
    console.log('\n🎬 ========== CLIPS ARRAY BUILT ==========');
    console.log(`🎬 Total clips created: ${clips.length}`);
    console.log(`🎬 Total video duration: ${totalDuration}s`);

    // 🚨 FINAL VERIFICATION: Ensure all scenes are included
    console.log('\n🚨 ========== FINAL VERIFICATION ==========');
    console.log(`🔢 Clips count: ${clips.length}`);
    console.log(`🔢 Expected count: ${totalScenes}`);
    console.log(`🔢 Scenes array length: ${scenes.length}`);
    
    if (clips.length !== totalScenes) {
      console.error(`❌ CRITICAL ERROR: CLIP COUNT MISMATCH!`);
      console.error(`   - Created clips: ${clips.length}`);
      console.error(`   - Expected clips: ${totalScenes}`);
      console.error(`   - Scenes in array: ${scenes.length}`);
      console.error('\n🔍 Debug info:');
      console.error('   - All scenes IDs:', scenes.map(s => s.id));
      console.error('   - All scene numbers:', scenes.map(s => s.scene_number));
      
      return new Response(JSON.stringify({ 
        error: `Failed to prepare all clips: ${clips.length}/${totalScenes}`,
        debug: {
          clipsCreated: clips.length,
          expectedClips: totalScenes,
          scenesInArray: scenes.length,
          sceneNumbers: scenes.map(s => s.scene_number)
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ VERIFICATION PASSED: All ${clips.length} clips ready`);
    console.log(`✅ Total video duration: ${totalDuration}s`);
    console.log('\n📦 Complete clips payload:');
    console.log(JSON.stringify(clips, null, 2));

    const edit = {
      timeline: {
        background: '#000000',
        tracks: [
          {
            clips: clips
          }
        ]
      },
      output: {
        format: 'mp4',
        resolution: 'hd'
      }
    };

    console.log('Shotstack edit payload:', JSON.stringify(edit, null, 2));

    // 🔁 AUTO KEY ROTATION: Submit to Shotstack with automatic key rotation
    const renderId = await tryWithAllKeys('shotstack', async (apiKey) => {
      const response = await fetch('https://api.shotstack.io/v1/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(edit)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shotstack Error:', errorText);
        throw new Error(`Shotstack: ${errorText}`);
      }

      const result = await response.json();
      return result.response.id;
    });

    console.log(`✅ Render started: ${renderId}`);

    // Update project status
    await supabaseAdmin
      .from('projects')
      .update({
        status: 'merging',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    // Store render ID in project for status checking
    await supabaseAdmin
      .from('projects')
      .update({
        final_video_url: renderId // Temporarily store render ID
      })
      .eq('id', projectId);

    return new Response(JSON.stringify({ 
      success: true,
      renderId: renderId,
      status: 'merging',
      totalScenes: totalScenes,
      scenesMerged: clips.length,
      customOrder: !!sceneIds
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in merge-videos:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
