# Media preview service contract

The portal queues a job after every completed video upload. The dedicated
file service is responsible for the ffmpeg work; the Next.js Worker must not
decode video files.

## Queue endpoint

`POST /media-previews/generate`

The existing file-server JWT authorization applies. The request body is:

```json
{
  "s3Key": "Client/outputs/September-2026/video.mp4",
  "fileId": "optional-task-file-id",
  "taskId": "optional-task-id",
  "mimeType": "video/mp4"
}
```

The endpoint must enqueue and return quickly. It must be idempotent by
`s3Key`; duplicate requests for the same object should coalesce.

## Processor requirements

1. Read the source object from R2.
2. Select a useful frame at roughly 10–15% of duration (fall back to 3 seconds
   for very short videos).
3. Write a max-1280px WebP preview under a non-user prefix such as
   `__media-previews/<stable-source-key-hash>.webp`.
4. Call the portal callback below. Failures must retry without deleting or
   modifying the source video.

## Completion callback

`POST /api/internal/media-previews/complete`

Header: `x-media-preview-secret: <MEDIA_PREVIEW_CALLBACK_SECRET>`

Success example:

```json
{
  "s3Key": "Client/outputs/September-2026/video.mp4",
  "fileId": "optional-task-file-id",
  "taskId": "optional-task-id",
  "previewS3Key": "__media-previews/abc123.webp",
  "status": "READY",
  "width": 1280,
  "height": 720,
  "durationSeconds": 32.1,
  "frameTimestampSeconds": 4.8,
  "attempts": 1
}
```

Failure example:

```json
{
  "s3Key": "Client/outputs/September-2026/video.mp4",
  "status": "FAILED",
  "attempts": 3,
  "errorMessage": "ffmpeg could not decode the source"
}
```

The portal serves completed previews through `/api/media-previews/image`; the
file service must implement `GET /media-previews/stream?key=...` and return
the stored image body with an image content type.
