/* =====================================================
   DATA API
   Firebase Data Access Layer for the LMS
   ===================================================== */

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

window.DataAPI = {

  /* ---------------------------------------------
     GET CURRENT USER PROFILE
  --------------------------------------------- */
  async getCurrentProfile() {

    const user = auth.currentUser;

    if (!user) return null;

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) return null;

    return { id: user.uid, ...snap.data() };
  },


  /* ---------------------------------------------
     GET ALL STUDENTS
     Tutors automatically see every student
  --------------------------------------------- */
  async getAllStudents() {

    const q = query(
      collection(db, "users"),
      where("role", "==", "student"),
      orderBy("name")
    );

    const snap = await getDocs(q);

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  },


  /* ---------------------------------------------
     GET STUDENT HISTORY
     Students + tutors view past activities
  --------------------------------------------- */
  async getStudentHistory(studentId) {

    const q = query(
      collection(db, "submissions"),
      where("studentId", "==", studentId),
      orderBy("submittedAt", "desc")
    );

    const snap = await getDocs(q);

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  },


  /* ---------------------------------------------
     GET STUDENT ASSIGNMENTS
  --------------------------------------------- */
  async getStudentAssignments(studentId) {

    const assignmentsSnap = await getDocs(collection(db, "assignments"));

    const assignments = [];

    assignmentsSnap.forEach(docSnap => {

      const data = docSnap.data();

      /* Assignment visible if:
         - directly assigned to student
         - studentId matches
         - assignedTo array contains student
         - published to all students
      */

      if (
        data.studentId === studentId ||
        data.targetType === "all_students" ||
        (Array.isArray(data.assignedTo) && data.assignedTo.includes(studentId))
      ) {
        assignments.push({
          id: docSnap.id,
          ...data
        });
      }

    });

    return assignments.sort((a,b)=>{

      const aTime = a.due_date?.seconds || 0;
      const bTime = b.due_date?.seconds || 0;

      return aTime - bTime;

    });
  },


  /* ---------------------------------------------
     PARENT -> CHILDREN
  --------------------------------------------- */
  async getParentChildren(parentId) {

    const q = query(
      collection(db, "student_parent_links"),
      where("parentId", "==", parentId)
    );

    const snap = await getDocs(q);

    const children = [];

    for (const linkDoc of snap.docs) {

      const studentId = linkDoc.data().studentId;

      const studentSnap = await getDoc(doc(db, "users", studentId));

      if (studentSnap.exists()) {

        children.push({
          student_id: studentId,
          ...studentSnap.data()
        });

      }

    }

    return children;
  },


  /* ---------------------------------------------
     PARENT REPORT
     Parents see children performance
  --------------------------------------------- */
  async getParentReport(parentId) {

    const children = await this.getParentChildren(parentId);

    const studentIds = children.map(c => c.student_id);

    if (!studentIds.length) return [];

    const q = query(
      collection(db, "submissions"),
      where("studentId", "in", studentIds),
      orderBy("submittedAt", "desc")
    );

    const snap = await getDocs(q);

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  },


  /* ---------------------------------------------
     TUTOR REVIEW SUBMISSION
  --------------------------------------------- */
  async reviewSubmission(submissionId, grade, feedback, tutorId) {

    const submissionRef = doc(db, "submissions", submissionId);

    await updateDoc(submissionRef, {

      grade: grade,
      feedback: feedback,
      reviewedBy: tutorId,
      reviewedAt: serverTimestamp(),
      status: "Reviewed"

    });

    return true;
  }

};