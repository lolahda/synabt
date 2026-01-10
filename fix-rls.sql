-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view api_keys" ON api_keys;
DROP POLICY IF EXISTS "Admins can insert api_keys" ON api_keys;
DROP POLICY IF EXISTS "Admins can update api_keys" ON api_keys;
DROP POLICY IF EXISTS "Admins can delete api_keys" ON api_keys;

-- Disable RLS on api_keys table (for now, will add proper RLS later)
ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;
