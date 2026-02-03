# 📮 Postman Quick Reference Card

## 🚀 Quick Start (3 Steps)

### 1. Get Access Token
Go to: https://developers.google.com/oauthplayground/
- Use your OAuth credentials
- Select YouTube scopes
- Get access token

### 2. Set Up Postman Request
```
Method: GET
URL: http://localhost:3000/api/youtube?action=ACTION_NAME
Header: Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 3. Send Request
Click "Send" and view response!

---

## 📋 All API Actions (Copy & Paste)

### 1. Get Channel Info
```
GET http://localhost:3000/api/youtube?action=channelInfo
Authorization: Bearer YOUR_TOKEN
```

### 2. Get Channel Videos
```
GET http://localhost:3000/api/youtube?action=channelVideos&maxResults=10
Authorization: Bearer YOUR_TOKEN
```

### 3. Get Video Details
```
GET http://localhost:3000/api/youtube?action=videoDetails&videoId=VIDEO_ID
Authorization: Bearer YOUR_TOKEN
```

### 4. Get Video Stats
```
GET http://localhost:3000/api/youtube?action=videoStats&videoId=VIDEO_ID
Authorization: Bearer YOUR_TOKEN
```

### 5. Search Videos
```
GET http://localhost:3000/api/youtube?action=search&query=SEARCH_TERM&maxResults=10
Authorization: Bearer YOUR_TOKEN
```

### 6. Get Comments
```
GET http://localhost:3000/api/youtube?action=comments&videoId=VIDEO_ID&maxResults=20
Authorization: Bearer YOUR_TOKEN
```

### 7. Get Playlists
```
GET http://localhost:3000/api/youtube?action=playlists&maxResults=25
Authorization: Bearer YOUR_TOKEN
```

### 8. Get Analytics
```
GET http://localhost:3000/api/youtube?action=analytics&channelId=CHANNEL_ID&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer YOUR_TOKEN
```

---

## 🔑 Your Credentials

```
Client ID: 943191497448-ugcm36tgo3et0tsv6lghi1h5iptvmssv.apps.googleusercontent.com
Client Secret: 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
```

---

## 🎯 Required YouTube Scopes

```
https://www.googleapis.com/auth/youtube.readonly
https://www.googleapis.com/auth/yt-analytics.readonly
```

---

## ⚡ Common Test Video IDs

```
dQw4w9WgXcQ  (Rick Astley - Never Gonna Give You Up)
jNQXAC9IVRw  (Me at the zoo - First YouTube video)
9bZkp7q19f0  (PSY - Gangnam Style)
```

---

## 🛠️ Postman Environment Variables

Create these in Postman:

| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:3000` |
| `access_token` | `YOUR_TOKEN_HERE` |

Then use in requests:
```
{{base_url}}/api/youtube?action=channelInfo
Authorization: Bearer {{access_token}}
```

---

## ⚠️ Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "Access token is required" | Add `Authorization: Bearer TOKEN` header |
| "Invalid credentials" | Get fresh token from OAuth Playground |
| "Quota exceeded" | Wait 24 hours or request quota increase |
| "videoId is required" | Add `videoId` parameter to URL |
| "Cannot GET /api/youtube" | Run `npm run dev` to start server |

---

## 📊 Response Format

All successful responses:
```json
{
  "success": true,
  "data": { ... }
}
```

All error responses:
```json
{
  "error": "Error message",
  "message": "Detailed error info"
}
```

---

## 🎉 Test Now!

1. Start your dev server: `npm run dev`
2. Get token from OAuth Playground
3. Open Postman
4. Copy any request above
5. Replace `YOUR_TOKEN` with your actual token
6. Click "Send"
7. Done! 🚀
