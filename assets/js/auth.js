// assets/js/auth.js

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const auth = window.FirebaseAuth;
const db = window.FirestoreDB;

if (!auth || !db) {
  throw new Error("Firebase not initialized. Load firebase-config.js before auth.js");
}

window.AuthAPI = {
  async register(payload) {
    const fullName = (payload.full_name || payload.fullName || "").trim();
    const email = (payload.email || "").trim().toLowerCase();
    const password = payload.password || "";
    const role = (payload.role || "student").trim().toLowerCase();

    if (!fullName) throw new Error("Full name is required");
    if (!email) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");
    if (!["student", "tutor", "parent"].includes(role)) {
      throw new Error("Invalid role selected");
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(cred.user, {
      displayName: fullName
    });

    const profileRef = doc(db, "profiles", cred.user.uid);

    await setDoc(profileRef, {
      id: cred.user.uid,
      uid: cred.user.uid,
      full_name: fullName,
      email,
      role,
      active: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }, { merge: true });

    return cred.user;
  },

  async login(email, password) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");

    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    await this.ensureProfileForCurrentUser();
    return cred.user;
  },

  async logout() {
    await signOut(auth);
  },

  getCurrentAuthUser() {
    return auth.currentUser || null;
  },

  async waitForAuth() {
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user || null);
      });
    });
  },

  async getCurrentProfile() {
    const user = auth.currentUser || await this.waitForAuth();
    if (!user) return null;

    const profileRef = doc(db, "profiles", user.uid);
    const snap = await getDoc(profileRef);

    if (!snap.exists()) {
      const fallbackProfile = {
        id: user.uid,
        uid: user.uid,
        full_name: user.displayName || "",
        email: user.email || "",
        role: "student",
        active: true
      };

      await setDoc(profileRef, {
        ...fallbackProfile,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }, { merge: true });

      return fallbackProfile;
    }

    return {
      id: snap.id,
      ...snap.data()
    };
  },

  async ensureProfileForCurrentUser() {
    const user = auth.currentUser || await this.waitForAuth();
    if (!user) return null;

    const profileRef = doc(db, "profiles", user.uid);
    const snap = await getDoc(profileRef);

    if (!snap.exists()) {
      const profile = {
        id: user.uid,
        uid: user.uid,
        full_name: user.displayName || "",
        email: user.email || "",
        role: "student",
        active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await setDoc(profileRef, profile, { merge: true });
      return profile;
    }

    return {
      id: snap.id,
      ...snap.data()
    };
  }
};