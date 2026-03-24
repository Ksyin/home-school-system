import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { FB } from "./app.js";

const db = FB.db;
const storage = FB.storage;

/* =====================================================
   STORAGE UPLOAD (FIREBASE)
===================================================== */

export async function uploadToStorage(file, folder = "uploads") {

  if (!file) return "";

  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${folder}/${Date.now()}-${safe}`;

  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file);

  return await getDownloadURL(storageRef);
}

/* =====================================================
   FETCH USERS BY ROLE
===================================================== */

export async function fetchProfilesByRole(role) {

  const q = query(
    collection(db, "users"),
    where("role", "==", role)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =====================================================
   FETCH ALL STUDENTS (FOR TUTOR DASHBOARD)
===================================================== */

export async function fetchAllStudents() {

  const q = query(
    collection(db, "users"),
    where("role", "==", "student")
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =====================================================
   CREATE ASSIGNMENT
===================================================== */

export async function createAssignment(data) {

  const refDoc = await addDoc(
    collection(db, "assignments"),
    {
      ...data,
      createdAt: serverTimestamp(),
      status: "pending"
    }
  );

  return refDoc.id;
}

/* =====================================================
   GET ASSIGNMENTS
===================================================== */

export async function getAssignments() {

  const snap = await getDocs(collection(db, "assignments"));

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =====================================================
   STUDENT SUBMISSION
===================================================== */

export async function submitAssignment(data) {

  const refDoc = await addDoc(
    collection(db, "submissions"),
    {
      ...data,
      submittedAt: serverTimestamp(),
      status: "submitted"
    }
  );

  return refDoc.id;
}

/* =====================================================
   TUTOR REVIEW
===================================================== */

export async function reviewSubmission(submissionId, grade, feedback) {

  const submissionRef = doc(db, "submissions", submissionId);

  await updateDoc(submissionRef, {
    grade: grade,
    feedback: feedback,
    status: "reviewed",
    reviewedAt: serverTimestamp()
  });

}

/* =====================================================
   GET STUDENT SUBMISSIONS
===================================================== */

export async function getStudentSubmissions(studentId) {

  const q = query(
    collection(db, "submissions"),
    where("studentId", "==", studentId)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}