import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ApiKey {
  id: string;
  service_name: string;
  api_key: string;
  is_active: boolean;
  usage_count: number;
  error_count: number;
  last_used_at?: string;
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Get all active API keys for a service, ordered by preference (least errors, least usage)
 */
export async function getAllActiveKeys(serviceName: string): Promise<ApiKey[]> {
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('*')
    .eq('service_name', serviceName)
    .eq('is_active', true)
    .order('error_count', { ascending: true })
    .order('usage_count', { ascending: true });

  if (error) {
    console.error(`Failed to get API keys for ${serviceName}:`, error);
    // Fallback to environment variable
    const envKey = Deno.env.get(`${serviceName.toUpperCase()}_API_KEY`);
    if (envKey) {
      return [{
        id: 'env',
        service_name: serviceName,
        api_key: envKey,
        is_active: true,
        usage_count: 0,
        error_count: 0
      }];
    }
    return [];
  }

  return data || [];
}

/**
 * Get best available API key (legacy, for backward compatibility)
 */
export async function getActiveApiKey(serviceName: string): Promise<string> {
  const keys = await getAllActiveKeys(serviceName);
  if (keys.length === 0) {
    throw new Error(`No API key found for ${serviceName}`);
  }
  return keys[0].api_key;
}

/**
 * Increment usage count for a specific key
 */
export async function incrementKeyUsage(keyId: string) {
  if (keyId === 'env') return; // Skip env keys

  const { data: currentKey } = await supabaseAdmin
    .from('api_keys')
    .select('usage_count')
    .eq('id', keyId)
    .single();

  if (currentKey) {
    await supabaseAdmin
      .from('api_keys')
      .update({ 
        usage_count: currentKey.usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyId);
  }
}

/**
 * Increment error count for a specific key
 */
export async function incrementKeyError(keyId: string) {
  if (keyId === 'env') return; // Skip env keys

  const { data: currentKey } = await supabaseAdmin
    .from('api_keys')
    .select('error_count')
    .eq('id', keyId)
    .single();

  if (currentKey) {
    await supabaseAdmin
      .from('api_keys')
      .update({ 
        error_count: currentKey.error_count + 1
      })
      .eq('id', keyId);
  }
}

/**
 * Detect if error is a key-related failure (quota, unauthorized, etc.)
 */
function isKeyFailure(error: any, responseText: string): boolean {
  const errorStr = (error?.message || responseText || '').toLowerCase();
  
  return (
    errorStr.includes('unauthorized') ||
    errorStr.includes('invalid') ||
    errorStr.includes('quota') ||
    errorStr.includes('rate limit') ||
    errorStr.includes('insufficient') ||
    errorStr.includes('expired') ||
    errorStr.includes('authentication') ||
    errorStr.includes('forbidden')
  );
}

/**
 * 🔁 AUTO KEY ROTATION: Try operation with all available keys until one succeeds
 * @param serviceName - The service to get keys for
 * @param operation - Async function that takes an API key and returns result
 * @returns Result from the operation
 * @throws Error only if ALL keys fail
 */
export async function tryWithAllKeys<T>(
  serviceName: string,
  operation: (apiKey: string) => Promise<T>
): Promise<T> {
  const keys = await getAllActiveKeys(serviceName);
  
  if (keys.length === 0) {
    throw new Error(`❌ No API keys available for ${serviceName}`);
  }

  console.log(`🔑 Found ${keys.length} active key(s) for ${serviceName}`);

  const errors: Array<{ keyId: string; error: string }> = [];

  // Try each key in order
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyLabel = key.id === 'env' ? 'ENV' : `#${i + 1}`;
    
    console.log(`🔄 [${serviceName}] Trying key ${keyLabel} (usage: ${key.usage_count}, errors: ${key.error_count})`);

    try {
      const result = await operation(key.api_key);
      
      // ✅ SUCCESS - increment usage and return
      await incrementKeyUsage(key.id);
      console.log(`✅ [${serviceName}] Success with key ${keyLabel}`);
      
      return result;

    } catch (error: any) {
      const errorText = error.message || String(error);
      console.error(`❌ [${serviceName}] Key ${keyLabel} failed:`, errorText);
      
      // Record error
      errors.push({ keyId: keyLabel, error: errorText });
      
      // Check if this is a key-related failure
      const isKeyIssue = isKeyFailure(error, errorText);
      
      if (isKeyIssue) {
        console.warn(`⚠️ [${serviceName}] Key ${keyLabel} failure detected - will try next key`);
        await incrementKeyError(key.id);
      } else {
        // If it's NOT a key issue (e.g., validation error, network issue), don't try other keys
        console.error(`🚫 [${serviceName}] Non-key failure - stopping rotation`);
        await incrementKeyError(key.id);
        throw error;
      }
      
      // If this was the last key, throw
      if (i === keys.length - 1) {
        const summary = errors.map(e => `${e.keyId}: ${e.error}`).join('; ');
        throw new Error(`❌ All ${keys.length} key(s) failed for ${serviceName}. Errors: ${summary}`);
      }
      
      // Continue to next key
      console.log(`🔁 [${serviceName}] Rotating to next key...`);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error(`❌ Unexpected: No keys processed for ${serviceName}`);
}
