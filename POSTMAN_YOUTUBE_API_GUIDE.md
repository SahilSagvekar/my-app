# 📮 Postman Guide - YouTube API Testing

## 🎯 How to Fetch YouTube Data Using Postman

This guide shows you how to test all YouTube API endpoints using Postman.

---

## 🔑 Step 1: Get Your Access Token

Before making any requests, you need a valid OAuth access token with YouTube scopes.

### Option A: Use Google OAuth Playground (Easiest)

1. Go to: https://developers.google.com/oauthplayground/
2. Click the ⚙️ (settings) icon in the top right
3. Check "Use your own OAuth credentials"
4. Enter your credentials:
   - **OAuth Client ID**: `943191497448-ugcm36tgo3et0tsv6lghi1h5iptvmssv.apps.googleusercontent.com`
   - **OAuth Client Secret**: `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`
5. In the left panel, find and select:
   - ✅ `YouTube Data API v3` → `https://www.googleapis.com/auth/youtube.readonly`
   - ✅ `YouTube Analytics API` → `https://www.googleapis.com/auth/yt-analytics.readonly`
6. Click "Authorize APIs"
7. Sign in with your Google account
8. Click "Exchange authorization code for tokens"
9. Copy the **Access token** (it will look like: `ya29.a0AfB_byC...`)

### Option B: Use Your App's OAuth Flow

1. Log in to your app with Google OAuth
2. Get the access token from your session/database
3. Copy it for use in Postman

---

## 📋 Step 2: Set Up Postman

### Create Environment Variables (Optional but Recommended)

1. In Postman, click "Environments" (left sidebar)
2. Click "+" to create a new environment
3. Name it "YouTube API"
4. Add these variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` |
| `access_token` | `YOUR_ACCESS_TOKEN_HERE` | `YOUR_ACCESS_TOKEN_HERE` |

5. Click "Save"
6. Select "YouTube API" environment from the dropdown (top right)

---

## 🚀 Step 3: Make API Requests

### Base URL
```
http://localhost:3000/api/youtube
```

### Required Header
All requests need this header:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## 📊 API Endpoints & Postman Examples

### 1️⃣ Get Channel Info

**Request:**
```
GET {{base_url}}/api/youtube?action=channelInfo
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "snippet": {
      "title": "Channel Name",
      "description": "Channel description",
      "customUrl": "@channelname",
      "publishedAt": "2015-01-01T00:00:00Z"
    },
    "statistics": {
      "viewCount": "1000000",
      "subscriberCount": "50000",
      "videoCount": "250"
    }
  }
}
```

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube?action=channelInfo`
3. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
4. Click "Send"

---

### 2️⃣ Get Channel Videos

**Request:**
```
GET {{base_url}}/api/youtube?action=channelVideos&maxResults=10
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters:**
- `action` = `channelVideos` (required)
- `maxResults` = `10` (optional, default: 25, max: 50)
- `channelId` = `UC_xxx` (optional, defaults to authenticated user's channel)

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube`
3. Params tab:
   - `action` = `channelVideos`
   - `maxResults` = `10`
4. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"

---

### 3️⃣ Get Video Details

**Request:**
```
GET {{base_url}}/api/youtube?action=videoDetails&videoId=dQw4w9WgXcQ
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters:**
- `action` = `videoDetails` (required)
- `videoId` = `dQw4w9WgXcQ` (required - replace with actual video ID)

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube`
3. Params tab:
   - `action` = `videoDetails`
   - `videoId` = `dQw4w9WgXcQ`
4. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"

---

### 4️⃣ Get Video Statistics

**Request:**
```
GET {{base_url}}/api/youtube?action=videoStats&videoId=dQw4w9WgXcQ
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "viewCount": "1234567",
    "likeCount": "45678",
    "commentCount": "1234",
    "favoriteCount": "0"
  }
}
```

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube`
3. Params tab:
   - `action` = `videoStats`
   - `videoId` = `dQw4w9WgXcQ`
4. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"

---

### 5️⃣ Search Videos

**Request:**
```
GET {{base_url}}/api/youtube?action=search&query=coding+tutorial&maxResults=10
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters:**
- `action` = `search` (required)
- `query` = `coding tutorial` (required - URL encoded)
- `maxResults` = `10` (optional, default: 10, max: 50)

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube`
3. Params tab:
   - `action` = `search`
   - `query` = `coding tutorial`
   - `maxResults` = `10`
4. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"

---

### 6️⃣ Get Video Comments

**Request:**
```
GET {{base_url}}/api/youtube?action=comments&videoId=dQw4w9WgXcQ&maxResults=20
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters:**
- `action` = `comments` (required)
- `videoId` = `dQw4w9WgXcQ` (required)
- `maxResults` = `20` (optional, default: 20, max: 100)

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube`
3. Params tab:
   - `action` = `comments`
   - `videoId` = `dQw4w9WgXcQ`
   - `maxResults` = `20`
4. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"

---

### 7️⃣ Get My Playlists

**Request:**
```
GET {{base_url}}/api/youtube?action=playlists&maxResults=25
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters:**
- `action` = `playlists` (required)
- `maxResults` = `25` (optional, default: 25, max: 50)

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube`
3. Params tab:
   - `action` = `playlists`
   - `maxResults` = `25`
4. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"

---

### 8️⃣ Get Channel Analytics

**Request:**
```
GET {{base_url}}/api/youtube?action=analytics&channelId=UC_xxx&startDate=2024-01-01&endDate=2024-12-31
```

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Query Parameters:**
- `action` = `analytics` (required)
- `channelId` = `UC_xxx` (required - your channel ID)
- `startDate` = `2024-01-01` (required - format: YYYY-MM-DD)
- `endDate` = `2024-12-31` (required - format: YYYY-MM-DD)

**Postman Setup:**
1. Method: `GET`
2. URL: `http://localhost:3000/api/youtube`
3. Params tab:
   - `action` = `analytics`
   - `channelId` = `UC_x5XG1OV2P6uZZ5FSM9Ttw`
   - `startDate` = `2024-01-01`
   - `endDate` = `2024-12-31`
4. Headers → Add: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"

---

## 🎯 Quick Postman Collection

You can import this collection into Postman:

```json
{
  "info": {
    "name": "YouTube API - E8 Productions",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Channel Info",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/youtube?action=channelInfo",
          "host": ["{{base_url}}"],
          "path": ["api", "youtube"],
          "query": [
            {
              "key": "action",
              "value": "channelInfo"
            }
          ]
        }
      }
    },
    {
      "name": "Get Channel Videos",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/youtube?action=channelVideos&maxResults=10",
          "host": ["{{base_url}}"],
          "path": ["api", "youtube"],
          "query": [
            {
              "key": "action",
              "value": "channelVideos"
            },
            {
              "key": "maxResults",
              "value": "10"
            }
          ]
        }
      }
    },
    {
      "name": "Get Video Stats",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/youtube?action=videoStats&videoId=dQw4w9WgXcQ",
          "host": ["{{base_url}}"],
          "path": ["api", "youtube"],
          "query": [
            {
              "key": "action",
              "value": "videoStats"
            },
            {
              "key": "videoId",
              "value": "dQw4w9WgXcQ"
            }
          ]
        }
      }
    },
    {
      "name": "Search Videos",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/youtube?action=search&query=coding tutorial&maxResults=10",
          "host": ["{{base_url}}"],
          "path": ["api", "youtube"],
          "query": [
            {
              "key": "action",
              "value": "search"
            },
            {
              "key": "query",
              "value": "coding tutorial"
            },
            {
              "key": "maxResults",
              "value": "10"
            }
          ]
        }
      }
    }
  ]
}
```

**To import:**
1. Open Postman
2. Click "Import" (top left)
3. Paste the JSON above
4. Click "Import"

---

## 🔧 Common Postman Settings

### Setting Authorization Header

**Method 1: Manual**
1. Go to "Headers" tab
2. Add key: `Authorization`
3. Add value: `Bearer YOUR_ACCESS_TOKEN`

**Method 2: Using Variables**
1. Set up environment variable `access_token`
2. In Headers tab, use: `Bearer {{access_token}}`

### Viewing Response

1. After clicking "Send", check the "Body" tab
2. Select "Pretty" and "JSON" for formatted view
3. Use "Raw" to see unformatted response

---

## ⚠️ Troubleshooting

### Error: "Access token is required"
- ✅ Make sure you added the `Authorization` header
- ✅ Check that the token starts with `Bearer `
- ✅ Verify the token is not expired (tokens expire after 1 hour)

### Error: "Invalid Credentials"
- ✅ Get a fresh access token from OAuth Playground
- ✅ Make sure YouTube Data API v3 is enabled in Google Cloud Console
- ✅ Verify you selected the correct YouTube scopes

### Error: "Quota exceeded"
- ✅ You've hit the daily API quota (10,000 units/day)
- ✅ Wait 24 hours or request quota increase

### Error: "videoId is required"
- ✅ Make sure you're passing the `videoId` parameter
- ✅ Use a valid YouTube video ID (e.g., `dQw4w9WgXcQ`)

### Error: "Cannot GET /api/youtube"
- ✅ Make sure your Next.js dev server is running (`npm run dev`)
- ✅ Check the URL is correct: `http://localhost:3000/api/youtube`

---

## 📝 Quick Reference

| Action | Required Params | Optional Params |
|--------|----------------|-----------------|
| `channelInfo` | - | `channelId` |
| `channelVideos` | - | `channelId`, `maxResults` |
| `videoDetails` | `videoId` | - |
| `videoStats` | `videoId` | - |
| `search` | `query` | `maxResults` |
| `comments` | `videoId` | `maxResults` |
| `playlists` | - | `maxResults` |
| `analytics` | `channelId`, `startDate`, `endDate` | - |

---

## 🎉 You're Ready!

Now you can test all YouTube API endpoints in Postman! 

**Quick Start:**
1. Get access token from OAuth Playground
2. Open Postman
3. Create a GET request to `http://localhost:3000/api/youtube?action=channelInfo`
4. Add header: `Authorization: Bearer YOUR_TOKEN`
5. Click "Send"
6. View the response! 🚀
