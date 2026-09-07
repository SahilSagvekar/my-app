# e8-file-server media-preview drop-in

Copy `src/media-preview-router.cjs` into `e8-file-server/src/`, then add the
contents of `src/index.mount-snippet.cjs` to its existing `src/index.js`.

This assumes the existing service is CommonJS + Express and already defines:

- `app` — Express application
- `s3` — R2-compatible AWS SDK S3Client
- `BUCKET` — R2 bucket name
- `requireAuth` — its existing Bearer JWT middleware

If its identifiers differ, adapt only those four values in the mount snippet.

Install ffmpeg/ffprobe on the file-service host, configure the environment
variables in `.env.example`, restart PM2, and apply the portal's
`drizzle/0004_add_media_previews.sql` migration before testing an upload.

The preview jobs are kept in the configured local queue file so an ordinary
PM2 restart resumes pending work. Back this directory up or replace it with a
shared durable queue before horizontally scaling the file service.
