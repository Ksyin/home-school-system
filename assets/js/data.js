// assets/js/data.js

import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const db = window.FirestoreDB;
const storage = window.FirebaseStorageRef;
const AuthAPI = window.AuthAPI;

if (!db || !storage) {
  throw new Error("Firebase not initialized. Load firebase-config.js before data.js");
}

async function requireProfile() {
  const profile = await AuthAPI.getCurrentProfile();
  if (!profile) throw new Error("No signed-in user");
  return profile;
}

window.DataAPI = {
  async getCurrentProfile() {
    return await AuthAPI.getCurrentProfile();
  },

  async getProfileById(userId) {
    if (!userId) throw new Error("User ID is required");
    const refDoc = doc(db, "profiles", userId);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  },

  async getAllStudents() {
    const q = query(
      collection(db, "profiles"),
      where("role", "==", "student")
    );

    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    rows.sort((a, b) => {
      const nameA = (a.full_name || "").toLowerCase();
      const nameB = (b.full_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return rows;
  },

  async getAllTutors() {
    const q = query(
      collection(db, "profiles"),
      where("role", "==", "tutor")
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  },

  async createAssignment(payload) {
    const me = await requireProfile();

    if (me.role !== "tutor" && me.role !== "parent") {
      throw new Error("Only tutor or parent can create assignments");
    }

    const title = (payload.title || "").trim();
    const description = (payload.description || "").trim();
    const subject = (payload.subject || "").trim();
    const due_date = payload.due_date || "";
    const target_student_ids = Array.isArray(payload.target_student_ids)
      ? payload.target_student_ids.filter(Boolean)
      : [];

    if (!title) throw new Error("Assignment title is required");
    if (!subject) throw new Error("Subject is required");

    const docRef = await addDoc(collection(db, "assignments"), {
      title,
      description,
      subject,
      due_date,
      target_student_ids,
      created_by: me.id,
      created_by_name: me.full_name || "",
      creator_role: me.role,
      status: "active",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    return docRef.id;
  },

  async updateAssignment(assignmentId, payload) {
    if (!assignmentId) throw new Error("Assignment ID is required");

    const me = await requireProfile();
    if (me.role !== "tutor" && me.role !== "parent") {
      throw new Error("Only tutor or parent can update assignments");
    }

    const assignmentRef = doc(db, "assignments", assignmentId);

    await updateDoc(assignmentRef, {
      title: (payload.title || "").trim(),
      description: (payload.description || "").trim(),
      subject: (payload.subject || "").trim(),
      due_date: payload.due_date || "",
      target_student_ids: Array.isArray(payload.target_student_ids)
        ? payload.target_student_ids.filter(Boolean)
        : [],
      updated_at: serverTimestamp()
    });
  },

  async getAssignments() {
    const me = await requireProfile();

    const snap = await getDocs(collection(db, "assignments"));

    let rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    rows.sort((a, b) => {
      const av = a.created_at?.seconds || 0;
      const bv = b.created_at?.seconds || 0;
      return bv - av;
    });

    if (me.role === "student") {
      rows = rows.filter((item) => {
        if (!Array.isArray(item.target_student_ids) || item.target_student_ids.length === 0) {
          return true;
        }
        return item.target_student_ids.includes(me.id);
      });
    }

    return rows;
  },

  async getAssignmentById(assignmentId) {
    if (!assignmentId) throw new Error("Assignment ID is required");

    const refDoc = doc(db, "assignments", assignmentId);
    const snap = await getDoc(refDoc);

    if (!snap.exists()) return null;

    return {
      id: snap.id,
      ...snap.data()
    };
  },

  async uploadSubmissionFile(file, assignmentId, studentId) {
    if (!file) return null;
    if (!assignmentId) throw new Error("Assignment ID is required");
    if (!studentId) throw new Error("Student ID is required");

    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const fileRef = ref(storage, `submissions/${studentId}/${assignmentId}/${safeName}`);

    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    return {
      file_name: file.name,
      file_url: url,
      file_size: file.size || 0,
      file_type: file.type || ""
    };
  },

  async submitAssignment(payload) {
    const me = await requireProfile();

    if (me.role !== "student") {
      throw new Error("Only students can submit assignments");
    }

    const assignment_id = payload.assignment_id || payload.assignmentId;
    const comment = (payload.comment || "").trim();

    if (!assignment_id) throw new Error("Assignment ID is required");

    const assignment = await this.getAssignmentById(assignment_id);
    if (!assignment) throw new Error("Assignment not found");

    const existing = await this.getSubmissionByStudentAndAssignment(me.id, assignment_id);

    let fileData = {
      file_name: "",
      file_url: "",
      file_size: 0,
      file_type: ""
    };

    if (payload.file) {
      fileData = await this.uploadSubmissionFile(payload.file, assignment_id, me.id);
    }

    if (existing) {
      const submissionRef = doc(db, "submissions", existing.id);

      await updateDoc(submissionRef, {
        comment,
        assignment_title: assignment.title || "",
        subject: assignment.subject || "",
        student_id: me.id,
        student_name: me.full_name || "",
        submitted_at: serverTimestamp(),
        status: "submitted",
        ...fileData,
        updated_at: serverTimestamp()
      });

      return existing.id;
    }

    const docRef = await addDoc(collection(db, "submissions"), {
      assignment_id,
      assignment_title: assignment.title || "",
      subject: assignment.subject || "",
      student_id: me.id,
      student_name: me.full_name || "",
      comment,
      status: "submitted",
      grade: "",
      feedback: "",
      reviewed: false,
      reviewed_by: "",
      reviewed_at: null,
      ...fileData,
      submitted_at: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    return docRef.id;
  },

  async getSubmissionByStudentAndAssignment(studentId, assignmentId) {
    const q = query(
      collection(db, "submissions"),
      where("student_id", "==", studentId),
      where("assignment_id", "==", assignmentId),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) return null;

    const first = snap.docs[0];
    return {
      id: first.id,
      ...first.data()
    };
  },

  async getStudentSubmissions(studentId) {
    if (!studentId) throw new Error("Student ID is required");

    const q = query(
      collection(db, "submissions"),
      where("student_id", "==", studentId)
    );

    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    rows.sort((a, b) => {
      const av = a.submitted_at?.seconds || 0;
      const bv = b.submitted_at?.seconds || 0;
      return bv - av;
    });

    return rows;
  },

  async getMySubmissions() {
    const me = await requireProfile();
    return await this.getStudentSubmissions(me.id);
  },

  async getAllSubmissions() {
    const me = await requireProfile();

    if (me.role !== "tutor" && me.role !== "parent") {
      throw new Error("Only tutor or parent can view all submissions");
    }

    const snap = await getDocs(collection(db, "submissions"));

    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    rows.sort((a, b) => {
      const av = a.submitted_at?.seconds || 0;
      const bv = b.submitted_at?.seconds || 0;
      return bv - av;
    });

    return rows;
  },

  async getAssignmentSubmissions(assignmentId) {
    if (!assignmentId) throw new Error("Assignment ID is required");

    const q = query(
      collection(db, "submissions"),
      where("assignment_id", "==", assignmentId)
    );

    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    rows.sort((a, b) => {
      const av = a.submitted_at?.seconds || 0;
      const bv = b.submitted_at?.seconds || 0;
      return bv - av;
    });

    return rows;
  },

  async reviewSubmission(submissionId, payload) {
    if (!submissionId) throw new Error("Submission ID is required");

    const me = await requireProfile();

    if (me.role !== "tutor" && me.role !== "parent") {
      throw new Error("Only tutor or parent can review submissions");
    }

    const submissionRef = doc(db, "submissions", submissionId);

    await updateDoc(submissionRef, {
      grade: (payload.grade || "").toString().trim(),
      feedback: (payload.feedback || "").trim(),
      reviewed: true,
      reviewed_by: me.id,
      reviewed_by_name: me.full_name || "",
      reviewed_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
  },

  async markSubmissionReviewed(submissionId) {
    if (!submissionId) throw new Error("Submission ID is required");

    const me = await requireProfile();

    if (me.role !== "tutor" && me.role !== "parent") {
      throw new Error("Only tutor or parent can mark reviewed");
    }

    const submissionRef = doc(db, "submissions", submissionId);

    await updateDoc(submissionRef, {
      reviewed: true,
      reviewed_by: me.id,
      reviewed_by_name: me.full_name || "",
      reviewed_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
  },

  async createParentChildLink(parentId, childId) {
    if (!parentId || !childId) throw new Error("Parent and child IDs are required");

    const linkId = `${parentId}_${childId}`;

    await setDoc(doc(db, "parent_child_links", linkId), {
      id: linkId,
      parent_id: parentId,
      child_id: childId,
      created_at: serverTimestamp()
    }, { merge: true });

    return linkId;
  },

  async getParentChildren(parentId) {
    if (!parentId) throw new Error("Parent ID is required");

    const q = query(
      collection(db, "parent_child_links"),
      where("parent_id", "==", parentId)
    );

    const linksSnap = await getDocs(q);

    const childIds = linksSnap.docs.map((d) => d.data().child_id).filter(Boolean);

    if (!childIds.length) return [];

    const allStudents = await this.getAllStudents();
    return allStudents.filter((student) => childIds.includes(student.id));
  }
};