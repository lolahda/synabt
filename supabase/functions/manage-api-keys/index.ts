import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ManageApiKeyRequest {
  action: 'list' | 'add' | 'toggle' | 'delete';
  service?: string;
  apiKey?: string;
  keyId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ استخدام SERVICE_ROLE_KEY للتحقق من JWT
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('JWT verification failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ User authenticated:', user.email);

    const { action, service, apiKey, keyId }: ManageApiKeyRequest = await req.json();

    // Check if user is admin using supabaseAdmin (service role)
    console.log('Checking admin status for email:', user.email);
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .maybeSingle();

    console.log('Admin check result:', adminCheck, 'Error:', adminError);

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Admin access required. Contact administrator.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'list': {
        const { data, error } = await supabaseAdmin
          .from('api_keys')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'add': {
        if (!service || !apiKey) {
          return new Response(JSON.stringify({ error: 'Missing service or apiKey' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await supabaseAdmin
          .from('api_keys')
          .insert({
            service_name: service.toLowerCase(),
            api_key: apiKey,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'toggle': {
        if (!keyId) {
          return new Response(JSON.stringify({ error: 'Missing keyId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get current status
        const { data: currentKey } = await supabaseAdmin
          .from('api_keys')
          .select('is_active')
          .eq('id', keyId)
          .single();

        if (!currentKey) {
          return new Response(JSON.stringify({ error: 'Key not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await supabaseAdmin
          .from('api_keys')
          .update({ is_active: !currentKey.is_active })
          .eq('id', keyId)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        if (!keyId) {
          return new Response(JSON.stringify({ error: 'Missing keyId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabaseAdmin
          .from('api_keys')
          .delete()
          .eq('id', keyId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in manage-api-keys:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
