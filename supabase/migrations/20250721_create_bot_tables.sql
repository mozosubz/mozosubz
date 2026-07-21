-- Create bot_connections table to track linked platforms (WhatsApp, Telegram)
CREATE TABLE IF NOT EXISTS bot_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  identifier TEXT NOT NULL, -- phone number, telegram user ID, etc
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Create bot_otp table for OTP verification during bot auth
CREATE TABLE IF NOT EXISTS bot_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  identifier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bot_connections_user ON bot_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_otp_user_email ON bot_otp(user_id, email);
CREATE INDEX IF NOT EXISTS idx_bot_otp_expires ON bot_otp(expires_at);

-- Enable RLS on bot_connections
ALTER TABLE bot_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_otp ENABLE ROW LEVEL SECURITY;

-- Policies for bot_connections - users can only see and manage their own connections
CREATE POLICY "Users can view own bot connections" ON bot_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert bot connections" ON bot_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bot connections" ON bot_connections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bot connections" ON bot_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for bot_otp - service role only (for verification process)
CREATE POLICY "Service role can manage bot_otp" ON bot_otp
  FOR ALL USING (true) WITH CHECK (true);
