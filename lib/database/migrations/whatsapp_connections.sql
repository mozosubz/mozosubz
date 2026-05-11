-- Create whatsapp_connections table for WhatsApp account linking
CREATE TABLE whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  connect_token_hash TEXT,
  connect_token_expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_whatsapp_connections_user_id ON whatsapp_connections(user_id);
CREATE INDEX idx_whatsapp_connections_whatsapp_number ON whatsapp_connections(whatsapp_number);
CREATE INDEX idx_whatsapp_connections_verified ON whatsapp_connections(verified) WHERE verified = TRUE;

-- Enable RLS
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own WhatsApp connection
CREATE POLICY "users_can_view_own_whatsapp" ON whatsapp_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can update their own WhatsApp connection
CREATE POLICY "users_can_update_own_whatsapp" ON whatsapp_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Service can insert WhatsApp connections
CREATE POLICY "service_can_insert_whatsapp" ON whatsapp_connections
  FOR INSERT
  WITH CHECK (TRUE);

-- RLS Policy: Service can select any WhatsApp connection (for authentication)
CREATE POLICY "service_can_select_whatsapp" ON whatsapp_connections
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_connections_updated_at
  BEFORE UPDATE ON whatsapp_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_connections_updated_at();
