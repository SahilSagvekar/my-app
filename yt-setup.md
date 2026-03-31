Steps for YouTube/Google API Setup
Step 1: Create Google Cloud Account

Go to console.cloud.google.com
Sign in with a Google account (or create one)
Accept Terms of Service


Step 2: Create a New Project

Click the project dropdown (top left, next to "Google Cloud")
Click New Project
Fill in:

Project Name: E8 Productions
Organization: Select if applicable


Click Create
Wait for project to be created, then select it


Step 3: Enable YouTube APIs

Go to APIs & Services → Library
Search and enable these APIs (click each → Enable):

YouTube Data API v3
YouTube Analytics API
YouTube Reporting API (optional)




Step 4: Configure OAuth Consent Screen

Go to APIs & Services → OAuth consent screen
Select External (for clients outside your org)
Click Create
Fill in:

App Name: E8 Productions
User support email: Your company email
App logo: Upload company logo (optional)
Developer contact email: Your email


Click Save and Continue

Add Scopes:

Click Add or Remove Scopes
Add these scopes:

   https://www.googleapis.com/auth/youtube.readonly
   https://www.googleapis.com/auth/yt-analytics.readonly
   https://www.googleapis.com/auth/userinfo.profile
   https://www.googleapis.com/auth/userinfo.email

Click Update → Save and Continue

Add Test Users (For Now):

Click Add Users
Add email addresses of people who will test (your clients' Gmail accounts)
Click Save and Continue


Step 5: Create OAuth Credentials

Go to APIs & Services → Credentials
Click Create Credentials → OAuth client ID
Select Web application
Fill in:

Name: E8 Productions Web Client
Authorized JavaScript origins:



     https://your-e8-app-domain.com

Authorized redirect URIs:

     https://your-e8-app-domain.com/api/social/callback/youtube
     https://your-e8-app-domain.com/api/youtube/callback

Click Create
Copy:

Client ID → Save as GOOGLE_YOUTUBE_CLIENT_ID
Client Secret → Save as GOOGLE_YOUTUBE_CLIENT_SECRET




Step 6: Give You the Credentials
Send you these securely:
GOOGLE_YOUTUBE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_YOUTUBE_CLIENT_SECRET=xxxxxxxxxx
You'll add these to your .env.local file.

Step 7: Publish App (Later - For All Clients)
While in Testing mode, only added test users can connect. To allow any client:

Go to OAuth consent screen
Click Publish App
If using sensitive scopes, Google will require:

Privacy Policy URL
Terms of Service URL
App verification (can take 2-4 weeks)




Summary for Your Boss
StepWhat to Do1Create Google Cloud account at console.cloud.google.com2Create new project called "E8 Productions"3Enable YouTube Data API v3 & YouTube Analytics API4Configure OAuth consent screen (External)5Add test users (client Gmail accounts)6Create OAuth credentials (Web application)7Add your callback URLs8Copy Client ID & Client Secret9Send credentials to you10Later: Publish app for all clients

Environment Variables You'll Need
bash# Meta/Facebook (for Facebook + Instagram)
META_APP_ID=xxxxxxxxxx
META_APP_SECRET=xxxxxxxxxx

# Google/YouTube
GOOGLE_YOUTUBE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_YOUTUBE_CLIENT_SECRET=xxxxxxxxxx

Want me to create a single document with both Meta and YouTube steps that you can send to your boss?