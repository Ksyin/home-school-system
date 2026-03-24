import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  orderBy
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
   STORAGE UPLOAD
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
   FETCH ALL STUDENTS (TUTOR SEES ALL)
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
   CREATE ASSIGNMENT (FIXED STRUCTURE)
===================================================== */

export async function createAssignment(data) {

  if (!data.studentId) {
    throw new Error("Student ID is required");
  }

  if (!data.title) {
    throw new Error("Assignment title required");
  }

  const refDoc = await addDoc(
    collection(db, "assignments"),
    {
      title: data.title,
      description: data.description || "",
      studentId: data.studentId,
      tutorId: data.tutorId,
      dueDate: data.dueDate || "",
      fileUrl: data.fileUrl || "",
      createdAt: serverTimestamp(),
      status: "pending"
    }
  );

  return refDoc.id;
}

/* =====================================================
   GET ASSIGNMENTS FOR STUDENT (CRITICAL FIX)
===================================================== */

export async function getAssignmentsForStudent(studentId) {

  const q = query(
    collection(db, "assignments"),
    where("studentId", "==", studentId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =====================================================
   GET ASSIGNMENTS FOR TUTOR
===================================================== */

export async function getAssignmentsForTutor(tutorId) {

  const q = query(
    collection(db, "assignments"),
    where("tutorId", "==", tutorId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =====================================================
   STUDENT SUBMISSION (FIXED LINK)
===================================================== */

export async function submitAssignment(data) {

  if (!data.assignmentId) {
    throw new Error("Assignment ID missing");
  }

  if (!data.studentId) {
    throw new Error("Student ID missing");
  }

  const refDoc = await addDoc(
    collection(db, "submissions"),
    {
      assignmentId: data.assignmentId,
      studentId: data.studentId,
      tutorId: data.tutorId,
      fileUrl: data.fileUrl || "",
      note: data.note || "",
      submittedAt: serverTimestamp(),
      status: "submitted"
    }
  );

  return refDoc.id;
}

/* =====================================================
   GET SUBMISSIONS FOR ASSIGNMENT (TUTOR VIEW)
===================================================== */

export async function getSubmissionsForAssignment(assignmentId) {

  const q = query(
    collection(db, "submissions"),
    where("assignmentId", "==", assignmentId)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
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

/* =====================================================
   REVIEW SUBMISSION
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