# 🔥 DuitOnTrack — Firebase Setup Guide

Follow these steps to connect your Firebase backend. Takes ~10 minutes.

---

## Step 1: Create a Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it: `duitontrack` (or anything you like)
4. Disable Google Analytics (not needed)
5. Click **"Create project"**

---

## Step 2: Enable Authentication

1. In the Firebase console, go to **Build → Authentication**
2. Click **"Get started"**
3. Enable these sign-in providers:
   - **Email/Password** → Enable → Save
   - **Google** → Enable → set support email → Save

---

## Step 3: Create Firestore Database

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll fix rules next)
4. Select a location (e.g., `asia-southeast1` for Malaysia)
5. Click **"Enable"**

---

## Step 4: Set Firestore Security Rules

Go to **Firestore → Rules** and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Goals subcollection
      match /goals/{goalId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        // Reports inside each goal
        match /reports/{reportId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
      
      // Chat history
      match /chatHistory/{chatId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      // Decisions
      match /decisions/{decisionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Click **"Publish"**.

---

## Step 5: Register Your Web App

1. In Firebase console, click the **gear icon ⚙️ → Project settings**
2. Scroll to **"Your apps"** → click **"</>  Web"** icon
3. App nickname: `DuitOnTrack Web`
4. **Don't** check Firebase Hosting (we're not using it)
5. Click **"Register app"**
6. You'll see a config block like this — **copy it**:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 6: Paste Config into Your App

Open `js/firebase.js` and replace the placeholder config at the top:

```js
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_SENDER_ID_HERE",
  appId: "PASTE_YOUR_APP_ID_HERE"
};
```

---

## Step 7: Enable Google Sign-In Domain

1. Go to **Authentication → Settings → Authorized domains**
2. Add your domain (e.g., `localhost` for local dev, or your hosting URL)
3. `localhost` is usually already there by default ✓

---

## Step 8: Connect Anthropic API (for AI chat)

The chat uses the Anthropic Claude API directly from the frontend.

> ⚠️ **For production**: Move API calls to a backend (Cloud Function) to hide your key.
> For development/demo, you can use it directly.

1. Get your API key from **https://console.anthropic.com**
2. The app currently calls `https://api.anthropic.com/v1/messages` directly
3. For a secure production setup, create a Firebase Cloud Function:

```js
// functions/index.js (Firebase Cloud Function)
const functions = require("firebase-functions");
const Anthropic = require("@anthropic-ai/sdk");

exports.askCoach = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  
  const client = new Anthropic({ apiKey: functions.config().anthropic.key });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: data.systemPrompt,
    messages: [{ role: "user", content: data.question }]
  });
  
  return { text: response.content[0].text };
});
```

Then deploy: `firebase deploy --only functions`

---

## Firestore Data Structure

```
users/
  {uid}/
    name: "Aina"
    email: "aina@example.com"
    profile/
      budget: 500
      daysLeft: 12
      sideIncome: "Tuition RM 60-80 × 3/month"
      mode: "jimat"
    
    goals/
      {goalId}/
        name: "Langkawi Trip"
        targetAmount: 600
        savedAmount: 240
        createdAt: Timestamp
        
        reports/
          "2024-10"/
            month: "2024-10"
            totalSaved: 240
            decisionsFollowed: 8
            decisionsTotal: 11
            pattern: "You overspend on Friday nights..."
            experiment: "Set RM 15 cap on Friday spending"
    
    chatHistory/
      {chatId}/
        question: "Boleh ke I beli AirPods RM 450?"
        verdict: "wait"
        aiResponse: "Wait dulu..."
        mode: "jimat"
        followed: true
        savedAmount: 60
        timestamp: Timestamp
    
    decisions/
      {decisionId}/
        question: "Boleh ke I take Grab RM 25?"
        verdict: "no"
        followed: false
        savedAmount: 0
        timestamp: Timestamp
```

---

## Done! 🎉

Your app is now connected to Firebase. Everything saves automatically:
- ✅ User registrations & logins (Auth)
- ✅ Budget profile per user (Firestore)
- ✅ Goals with progress (Firestore subcollection)
- ✅ Full AI chat history (Firestore, used as AI memory)
- ✅ Decision tracking strip (Firestore)
- ✅ Monthly reports per goal (Firestore subcollection)
