

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── YOUR FIREBASE CONFIG (replace with yours) ────

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCZGnZ8e4T9lyjtUh9ThdHq103daYLTsaM",
  authDomain: "duitontrack.firebaseapp.com",
  projectId: "duitontrack",
  storageBucket: "duitontrack.firebasestorage.app",
  messagingSenderId: "982618863016",
  appId: "1:982618863016:web:1358ba3a84fff24744d99d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── AUTH FUNCTIONS ───────────────────────────────

/**
 * Register with email + password
 * Creates user in Firebase Auth + Firestore user doc
 */
export async function registerWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await createUserDoc(cred.user, { name });
  return cred.user;
}

/**
 * Sign in with email + password
 */
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Sign in / register with Google popup
 */
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  // Check if user doc already exists; if not, create one
  const userRef = doc(db, "users", cred.user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await createUserDoc(cred.user, { name: cred.user.displayName });
  }
  return cred.user;
}

/**
 * Sign out current user
 */
export async function logout() {
  await signOut(auth);
}

/**
 * Listen for auth state changes
 * @param {Function} callback - called with (user | null)
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── FIRESTORE: USER DOC ──────────────────────────

/**
 * Create initial user document in Firestore
 * Path: users/{uid}
 */
async function createUserDoc(firebaseUser, extra = {}) {
  const userRef = doc(db, "users", firebaseUser.uid);
  await setDoc(userRef, {
    uid: firebaseUser.uid,
    name: extra.name || firebaseUser.displayName || "User",
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL || null,
    createdAt: serverTimestamp(),
    // Default profile — overwritten after Setup
    profile: {
      budget: 0,
      daysLeft: 0,
      sideIncome: "",
      mode: "jimat"
    }
  }, { merge: true });
}

/**
 * Get user document
 * Returns: { uid, name, email, profile, ... }
 */
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Update user profile (budget, days, income, mode)
 */
export async function updateUserProfile(uid, profileData) {
  await updateDoc(doc(db, "users", uid), {
    "profile.budget": profileData.budget,
    "profile.daysLeft": profileData.daysLeft,
    "profile.sideIncome": profileData.sideIncome,
    "profile.mode": profileData.mode || "jimat",
    updatedAt: serverTimestamp()
  });
}

// ── FIRESTORE: GOALS ─────────────────────────────
// Path: users/{uid}/goals/{goalId}

/**
 * Add a new goal
 */
export async function addGoal(uid, goalData) {
  const goalsRef = collection(db, "users", uid, "goals");
  const docRef = await addDoc(goalsRef, {
    name: goalData.name,
    targetAmount: goalData.targetAmount,
    savedAmount: goalData.savedAmount || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Get all goals for a user
 */
export async function getGoals(uid) {
  const q = query(collection(db, "users", uid, "goals"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Update saved amount for a goal
 */
export async function updateGoalSaved(uid, goalId, savedAmount) {
  await updateDoc(doc(db, "users", uid, "goals", goalId), {
    savedAmount,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a goal
 */
export async function deleteGoal(uid, goalId) {
  await deleteDoc(doc(db, "users", uid, "goals", goalId));
}

// ── FIRESTORE: CHAT HISTORY ──────────────────────
// Path: users/{uid}/chatHistory/{docId}
// Stored per question/answer pair

/**
 * Save a chat exchange to Firestore
 */
export async function saveChatMessage(uid, entry) {
  await addDoc(collection(db, "users", uid, "chatHistory"), {
    question: entry.question,
    verdict: entry.verdict,        // 'yes' | 'wait' | 'no'
    aiResponse: entry.aiResponse,
    mode: entry.mode,              // 'jimat' | 'pakai'
    followed: entry.followed ?? null, // null = not yet decided
    savedAmount: entry.savedAmount || 0,
    goalId: entry.goalId || null,  // which goal this relates to (optional)
    timestamp: serverTimestamp()
  });
}

/**
 * Update whether user followed advice (called when they tap Follow/Ignore)
 */
export async function updateChatFollowed(uid, chatId, followed, savedAmount = 0) {
  await updateDoc(doc(db, "users", uid, "chatHistory", chatId), {
    followed,
    savedAmount
  });
}

/**
 * Get recent chat history (last N messages)
 * Used to give AI context of past conversations
 */
export async function getRecentChatHistory(uid, count = 20) {
  const q = query(
    collection(db, "users", uid, "chatHistory"),
    orderBy("timestamp", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
}

// ── FIRESTORE: MONTHLY REPORTS ───────────────────
// Path: users/{uid}/reports/{YYYY-MM}
// Reports are auto-generated at month-end and saved

/**
 * Save a monthly report
 */
export async function saveMonthlyReport(uid, goalId, reportData) {
  const monthKey = reportData.month; // e.g. "2024-10"
  await setDoc(doc(db, "users", uid, "goals", goalId, "reports", monthKey), {
    month: reportData.month,
    totalSaved: reportData.totalSaved,
    decisionsFollowed: reportData.decisionsFollowed,
    decisionsTotal: reportData.decisionsTotal,
    followRate: reportData.followRate,
    topLeaks: reportData.topLeaks,        // array of { label, amount }
    topWins: reportData.topWins,          // array of { label, amount }
    pattern: reportData.pattern,          // AI-generated string
    experiment: reportData.experiment,    // AI-generated string
    generatedAt: serverTimestamp()
  });
}

/**
 * Get all monthly reports for a goal
 */
export async function getGoalReports(uid, goalId) {
  const snap = await getDocs(collection(db, "users", uid, "goals", goalId, "reports"));
  return snap.docs.map(d => d.data()).sort((a, b) => b.month.localeCompare(a.month));
}

// ── FIRESTORE: DECISIONS (Dashboard strip) ───────
// Path: users/{uid}/decisions/{docId}

/**
 * Save a decision (from dashboard quick-ask or chat)
 */
export async function saveDecision(uid, decision) {
  await addDoc(collection(db, "users", uid, "decisions"), {
    question: decision.question,
    verdict: decision.verdict,
    followed: decision.followed ?? null,
    savedAmount: decision.savedAmount || 0,
    goalId: decision.goalId || null,
    timestamp: serverTimestamp()
  });
}

/**
 * Get recent decisions (for dashboard strip)
 */
export async function getRecentDecisions(uid, count = 10) {
  const q = query(
    collection(db, "users", uid, "decisions"),
    orderBy("timestamp", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export { auth, db };
