-- Email verification (INTEGER user ids)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
    user_id INTEGER PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    last_sent_at TIMESTAMP NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires
ON public.email_verification_codes (expires_at);
