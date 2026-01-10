-- Enable RLS on api_keys table
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only to view API keys
CREATE POLICY "Admins can view api_keys"
  ON api_keys
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM admin_users
    )
  );

-- Create policy for admins only to insert API keys
CREATE POLICY "Admins can insert api_keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM admin_users
    )
  );

-- Create policy for admins only to update API keys
CREATE POLICY "Admins can update api_keys"
  ON api_keys
  FOR UPDATE
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM admin_users
    )
  );

-- Create policy for admins only to delete API keys
CREATE POLICY "Admins can delete api_keys"
  ON api_keys
  FOR DELETE
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM admin_users
    )
  );
