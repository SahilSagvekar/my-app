-- Announcements: which Slack channels to post to. Idempotent.
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "slackChannels" text[] DEFAULT ARRAY[]::text[] NOT NULL;
