-- Connect Keys Table for API Integration
CREATE TABLE IF NOT EXISTS connect_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_preview TEXT NOT NULL,
  permissions TEXT[] DEFAULT ARRAY['services', 'deposits', 'balance'],
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_ip TEXT,
  user_agent TEXT,
  max_requests_per_day INT DEFAULT 10000,
  rate_limit_window INT DEFAULT 3600,
  request_count INT DEFAULT 0,
  request_count_reset_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_connect_keys_user_id ON connect_keys(user_id);
CREATE INDEX idx_connect_keys_key_hash ON connect_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_connect_keys_active ON connect_keys(user_id) WHERE is_active = true AND revoked_at IS NULL;

ALTER TABLE connect_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own keys" ON connect_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own keys" ON connect_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own keys" ON connect_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own keys" ON connect_keys FOR DELETE USING (auth.uid() = user_id);

-- API Logs Table
CREATE TABLE IF NOT EXISTS connect_key_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_id UUID NOT NULL REFERENCES connect_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_connect_key_logs_user_id ON connect_key_logs(user_id);
CREATE INDEX idx_connect_key_logs_key_id ON connect_key_logs(key_id);

ALTER TABLE connect_key_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own logs" ON connect_key_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert logs" ON connect_key_logs FOR INSERT WITH CHECK (true);
