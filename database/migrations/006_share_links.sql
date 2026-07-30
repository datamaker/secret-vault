-- E2E encrypted share links (doppler share 스타일)
-- 브라우저가 암호화한 ciphertext만 저장한다. 복호화 키는 URL fragment로만 전달되어 서버는 평문을 알 수 없다.

CREATE TABLE share_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ciphertext TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    max_views INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_share_links_expires ON share_links(expires_at);
