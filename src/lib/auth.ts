import { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
}

export function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username || user.user_metadata?.full_name || user.email!.split('@')[0],
    avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
  };
}
