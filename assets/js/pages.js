import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

window.FB = { app, auth, db, storage };

const pageRole = document.body.dataset.role || '';
const pageKey = document.body.dataset.page || '';
const pageTitle = document.body.dataset.title || 'HomeSchool';
const pageDescription = document.body.dataset.description || '';

const navMap = {
  parent: [
    ['Dashboard', '/parent/dashboard.html', '🏠'],
    ['Children', '/parent/children.html', '👧'],
    ['Assignments', '/parent/assignments.html', '📝'],
    ['Assessments', '/parent/assessments.html', '📊'],
    ['Portfolio', '/parent/portfolio.html', '🗂️'],
    ['Attendance', '/parent/attendance.html', '📅'],
    ['Reports', '/parent/reports.html', '📄'],
    ['Resources', '/parent/resources.html', '📚'],
    ['Messages', '/parent/messages.html', '💬'],
    ['Settings', '/parent/settings.html', '⚙️']
  ],
  tutor: [
    ['Dashboard', '/tutor/dashboard.html', '🏠'],
    ['Learners', '/tutor/learners.html', '👦'],
    ['Classrooms', '/tutor/classrooms.html', '🏫'],
    ['Assignments', '/tutor/assignments.html', '📝'],
    ['Assessments', '/tutor/assessments.html', '📊'],
    ['Portfolios', '/tutor/portfolios.html', '🗂️'],
    ['Attendance', '/tutor/attendance.html', '📅'],
    ['Report Cards', '/tutor/reports.html', '📄'],
    ['Lesson Plans', '/tutor/lesson-plans.html', '🗓️'],
    ['Resources', '/tutor/resources.html', '📚'],
    ['Messages', '/tutor/messages.html', '💬'],
    ['Settings', '/tutor/settings.html', '⚙️']
  ],
  student: [
    ['Dashboard', '/student/dashboard.html', '🏠'],
    ['My Assignments', '/student/assignments.html', '📝'],
    ['Submit Work', '/student/submit-work.html', '📤'],
    ['Assessments', '/student/assessments.html', '📊'],
    ['Portfolio', '/student/portfolio.html', '🗂️'],
    ['Attendance', '/student/attendance.html', '📅'],
    ['Reports', '/student/reports.html', '📄'],
    ['Resources', '/student/resources.html', '📚'],
    ['Messages', '/student/messages.html', '💬'],
    ['Settings', '/student/settings.html', '⚙️']
  ]
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function uiHeader(profile) {
  return `
    <div class="topbar">
      <div>
        <h2>${escapeHtml(pageTitle)}</h2>
        <p>${escapeHtml(pageDescription)}</p>
      </div>
      <div class="top-actions">
        <span class="badge">${escapeHtml(profile?.role || 'guest')}</span>
        <span class="badge success">${escapeHtml(profile?.name || profile?.full_name || profile?.email || '')}</span>
        <button class="btn" id="logoutBtn" type="button">Logout</button>
      </div>
    </div>
  `;
}

function sidebar(profile) {
  const items = navMap[pageRole] || [];
  const links = items.map(([label, href, icon]) => `
    <a class="${href.endsWith(pageKey + '.html') ? 'active' : ''}" href="${href}">
      <span class="icon">${icon}</span>
      <span>${escapeHtml(label)}</span>
    </a>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-badge">H</div>
        <div>
          <h1>HomeSchool</h1>
          <p>Management System</p>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-title">${escapeHtml(pageRole)} portal</div>
        <nav class="nav">${links}</nav>
      </div>

      <div class="sidebar-footer">
        <div>${escapeHtml(profile?.name || profile?.full_name || '')}</div>
        <small>${escapeHtml(profile?.email || '')}</small>
        <small>Role: ${escapeHtml(profile?.role || pageRole)}</small>
      </div>
    </aside>
  `;
}

function fmtDate(value) {
  if (!value) return '—';
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
  }
  if (value?.toDate) return value.toDate().toLocaleString();
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function statusBadge(status = 'Pending') {
  const map = {
    Completed: 'success',
    Submitted: 'success',
    Pending: 'warn',
    Late: 'danger',
    Draft: '',
    Published: 'success',
    Present: 'success',
    Absent: 'danger',
    Archived: 'warn'
  };
  return `<span class="badge ${map[status] || ''}">${escapeHtml(status)}</span>`;
}

function simpleTable(headers, rowsHtml) {
  return `
    <div class="card panel table-wrap">
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="${headers.length}"><div class="empty">No records yet.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

async function getUserProfile(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  return userDoc.data();
}

async function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.href = '/login.html';
        return;
      }

      const profile = await getUserProfile(user.uid);
      if (!profile) {
        location.href = '/unauthorized.html';
        return;
      }

      if (pageRole && profile.role !== pageRole) {
        location.href = '/unauthorized.html';
        return;
      }

      const shell = document.getElementById('app-shell');
      if (!shell) {
        console.error('Missing #app-shell in page HTML');
        return;
      }

      shell.innerHTML = `
        ${sidebar({ ...profile, email: user.email })}
        <main class="content">
          ${uiHeader({ ...profile, email: user.email })}
          <div id="page-content"></div>
          <footer class="page-foot">HomeSchool student system</footer>
        </main>
      `;

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.onclick = async () => {
          await signOut(auth);
          location.href = '/login.html';
        };
      }

      resolve({ user, profile });
    });
  });
}

async function uploadFile(file, folder = 'uploads') {
  if (!file) return { url: '', path: '', name: '' };

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const filePath = `${folder}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return {
    url,
    path: filePath,
    name: file.name
  };
}

function getStudentDisplayName(profile, user) {
  return profile?.full_name || profile?.name || user?.displayName || user?.email || 'Student';
}

function normalizeAssignment(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data
  };
}

function assignmentVisibleToStudent(assignment, studentUid) {
  if (!assignment) return false;

  if (assignment.studentId && assignment.studentId === studentUid) return true;
  if (Array.isArray(assignment.studentIds) && assignment.studentIds.includes(studentUid)) return true;
  if (Array.isArray(assignment.assignedTo) && assignment.assignedTo.includes(studentUid)) return true;
  if (assignment.targetType === 'all_students') return true;
  if (assignment.published === true && !assignment.studentId && !assignment.studentIds && !assignment.assignedTo) return true;

  return false;
}

async function loadStudentAssignments(studentUid) {
  const snap = await getDocs(collection(db, 'assignments'));
  const allAssignments = snap.docs.map(normalizeAssignment);

  return allAssignments
    .filter(item => assignmentVisibleToStudent(item, studentUid))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

async function loadStudentSubmissions(studentUid) {
  const submissionsQuery = query(
    collection(db, 'submissions'),
    where('studentId', '==', studentUid)
  );

  const snap = await getDocs(submissionsQuery);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a, b) => {
    const aTime = a.submittedAt?.seconds || 0;
    const bTime = b.submittedAt?.seconds || 0;
    return bTime - aTime;
  });
}

/* =========================
   STUDENT AUTO MIRROR
========================= */

async function ensureStudentMirror(user, profile) {
  if (!user) return;

  const studentName = getStudentDisplayName(profile, user);
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      name: studentName,
      full_name: studentName,
      email: user.email || '',
      role: 'student',
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  batch.set(
    doc(db, 'students', user.uid),
    {
      uid: user.uid,
      name: studentName,
      full_name: studentName,
      email: user.email || '',
      role: 'student',
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await batch.commit();
}

/* =========================
   LESSON PLANS
========================= */

function normalizeLessonPlan(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title || '',
    subject: data.subject || '',
    classroomName: data.classroomName || '',
    plannedDate: data.plannedDate || '',
    objectives: data.objectives || '',
    materials: data.materials || '',
    notes: data.notes || '',
    attachmentUrl: data.attachmentUrl || '',
    attachmentPath: data.attachmentPath || '',
    attachmentName: data.attachmentName || '',
    tutorId: data.tutorId || '',
    tutorName: data.tutorName || '',
    status: data.status || 'Draft',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

async function loadTutorLessonPlans(tutorUid) {
  const q = query(
    collection(db, 'lesson-plans'),
    where('tutorId', '==', tutorUid)
  );

  const snap = await getDocs(q);

  return snap.docs
    .map(normalizeLessonPlan)
    .sort((a, b) => {
      const aDate = a.plannedDate ? new Date(a.plannedDate).getTime() : 0;
      const bDate = b.plannedDate ? new Date(b.plannedDate).getTime() : 0;

      if (bDate !== aDate) return bDate - aDate;

      const aCreated = a.createdAt?.seconds || 0;
      const bCreated = b.createdAt?.seconds || 0;
      return bCreated - aCreated;
    });
}

/* =========================
   LEARNERS / CLASSROOMS / RESOURCES / MESSAGES
========================= */

async function loadAllStudents() {
  const snap = await getDocs(
    query(collection(db, 'users'), where('role', '==', 'student'))
  );

  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aName = (a.full_name || a.name || a.email || '').toLowerCase();
      const bName = (b.full_name || b.name || b.email || '').toLowerCase();
      return aName.localeCompare(bName);
    });
}

async function loadLearnerNotes(tutorUid) {
  const snap = await getDocs(
    query(collection(db, 'student-notes'), where('tutorId', '==', tutorUid))
  );

  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

async function loadClassrooms(tutorUid) {
  const snap = await getDocs(
    query(collection(db, 'classrooms'), where('tutorId', '==', tutorUid))
  );

  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

async function loadResources(tutorUid) {
  const snap = await getDocs(
    query(collection(db, 'resources'), where('tutorId', '==', tutorUid))
  );

  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

async function loadMessagesForTutor(tutorUid) {
  const snap = await getDocs(
    query(collection(db, 'messages'), where('tutorId', '==', tutorUid))
  );

  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

/* =========================
   RENDER: STUDENT SUBMIT WORK
========================= */

function renderSubmitWorkPage(profile, user, assignments, submissions) {
  const studentName = getStudentDisplayName(profile, user);

  const options = assignments.map(item => `
    <option value="${escapeHtml(item.id)}">
      ${escapeHtml(item.title || 'Untitled Assignment')} ${item.subject ? `- ${escapeHtml(item.subject)}` : ''}
    </option>
  `).join('');

  const submissionRows = submissions.map(item => `
    <tr>
      <td>${escapeHtml(item.assignmentTitle || 'Assignment')}</td>
      <td>${escapeHtml(item.subject || '—')}</td>
      <td>${statusBadge(item.status || 'Submitted')}</td>
      <td>${fmtDate(item.submittedAt)}</td>
      <td>${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" rel="noopener">View File</a>` : '—'}</td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <h3>Submit Assignment</h3>
      <p>Welcome, ${escapeHtml(studentName)}. Choose an assignment, attach your work, and submit it.</p>

      <form id="submissionForm" class="stack-form">
        <div class="form-row">
          <label for="assignmentId">Assignment</label>
          <select id="assignmentId" name="assignmentId" required>
            <option value="">Select assignment</option>
            ${options}
          </select>
        </div>

        <div class="form-row">
          <label for="submissionNote">Message / Notes</label>
          <textarea id="submissionNote" name="submissionNote" rows="5" placeholder="Add notes about this work"></textarea>
        </div>

        <div class="form-row">
          <label for="submissionFile">Attach file</label>
          <input id="submissionFile" name="submissionFile" type="file">
        </div>

        <div class="form-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button type="submit" class="btn" id="submitWorkBtn">Submit Work</button>
          <span id="submitWorkMsg"></span>
        </div>
      </form>
    </section>

    <section class="card panel" style="margin-top:18px">
      <h3>My Previous Submissions</h3>
      ${simpleTable(
        ['Assignment', 'Subject', 'Status', 'Submitted', 'Attachment'],
        submissionRows
      )}
    </section>
  `;
}

/* =========================
   RENDER: LESSON PLANS
========================= */

function renderLessonPlanForm(editingPlan = null) {
  return `
    <section class="card panel">
      <h3>${editingPlan ? 'Edit Lesson Plan' : 'Create Lesson Plan'}</h3>
      <p>Build real lesson plans that save to Firebase and appear instantly below.</p>

      <form id="lessonPlanForm" class="stack-form">
        <input type="hidden" id="planId" value="${escapeHtml(editingPlan?.id || '')}">

        <div class="form-row">
          <label for="planTitle">Lesson Title</label>
          <input
            id="planTitle"
            name="planTitle"
            type="text"
            required
            placeholder="e.g. Photosynthesis and Plant Cells"
            value="${escapeHtml(editingPlan?.title || '')}"
          >
        </div>

        <div class="form-row">
          <label for="planSubject">Subject</label>
          <input
            id="planSubject"
            name="planSubject"
            type="text"
            required
            placeholder="Science"
            value="${escapeHtml(editingPlan?.subject || '')}"
          >
        </div>

        <div class="form-row">
          <label for="planClassroom">Classroom / Grade</label>
          <input
            id="planClassroom"
            name="planClassroom"
            type="text"
            required
            placeholder="Grade 7 Science"
            value="${escapeHtml(editingPlan?.classroomName || '')}"
          >
        </div>

        <div class="form-row">
          <label for="planDate">Planned Date</label>
          <input
            id="planDate"
            name="planDate"
            type="date"
            required
            value="${escapeHtml(editingPlan?.plannedDate || '')}"
          >
        </div>

        <div class="form-row">
          <label for="planObjectives">Objectives / Goals</label>
          <textarea
            id="planObjectives"
            name="planObjectives"
            rows="4"
            placeholder="Students will be able to..."
          >${escapeHtml(editingPlan?.objectives || '')}</textarea>
        </div>

        <div class="form-row">
          <label for="planMaterials">Materials / Resources</label>
          <textarea
            id="planMaterials"
            name="planMaterials"
            rows="3"
            placeholder="Book pages, links, worksheets, lab tools..."
          >${escapeHtml(editingPlan?.materials || '')}</textarea>
        </div>

        <div class="form-row">
          <label for="planNotes">Lesson Notes / Activities</label>
          <textarea
            id="planNotes"
            name="planNotes"
            rows="5"
            placeholder="Warm-up, main activity, discussion, homework..."
          >${escapeHtml(editingPlan?.notes || '')}</textarea>
        </div>

        <div class="form-row">
          <label for="planAttachment">Attachment (optional)</label>
          <input id="planAttachment" name="planAttachment" type="file">
          ${
            editingPlan?.attachmentUrl
              ? `<small>Current file: <a href="${editingPlan.attachmentUrl}" target="_blank" rel="noopener">${escapeHtml(editingPlan.attachmentName || 'Open attachment')}</a></small>`
              : ''
          }
        </div>

        <div class="form-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button type="submit" class="btn" id="createPlanBtn">${editingPlan ? 'Update Lesson Plan' : 'Save Lesson Plan'}</button>
          ${editingPlan ? `<button type="button" class="btn" id="cancelEditPlanBtn">Cancel Edit</button>` : ''}
          <span id="lessonPlanMsg"></span>
        </div>
      </form>
    </section>
  `;
}

function renderLessonPlansTable(plans) {
  const rowsHtml = plans.map(item => `
    <tr>
      <td>${escapeHtml(item.title || 'Untitled')}</td>
      <td>${escapeHtml(item.subject || '—')}</td>
      <td>${escapeHtml(item.classroomName || '—')}</td>
      <td>${fmtDate(item.plannedDate)}</td>
      <td>${statusBadge(item.status || 'Draft')}</td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn plan-edit-btn" type="button" data-id="${escapeHtml(item.id)}">Edit</button>
          <button class="btn plan-status-btn" type="button" data-id="${escapeHtml(item.id)}" data-status="${item.status === 'Published' ? 'Draft' : 'Published'}">
            ${item.status === 'Published' ? 'Move to Draft' : 'Publish'}
          </button>
          <button class="btn plan-delete-btn" type="button" data-id="${escapeHtml(item.id)}">Delete</button>
          ${item.attachmentUrl ? `<a class="btn" href="${item.attachmentUrl}" target="_blank" rel="noopener">Attachment</a>` : ''}
        </div>
      </td>
    </tr>
    <tr>
      <td colspan="6">
        <div style="padding:8px 0">
          <strong>Objectives:</strong> ${escapeHtml(item.objectives || '—')}<br>
          <strong>Materials:</strong> ${escapeHtml(item.materials || '—')}<br>
          <strong>Notes:</strong> ${escapeHtml(item.notes || '—')}
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <section class="card panel" style="margin-top:18px">
      <h3>My Lesson Plans</h3>
      ${simpleTable(
        ['Title', 'Subject', 'Classroom', 'Date', 'Status', 'Actions'],
        rowsHtml
      )}
    </section>
  `;
}

function renderLessonPlansPage(profile, lessonPlans, editingPlan = null) {
  const tutorName = profile?.name || profile?.full_name || 'Tutor';

  return `
    <section class="card panel" style="margin-bottom:18px">
      <h3>${escapeHtml(tutorName)}'s Lesson Planner</h3>
      <p>Create lesson plans, save them as drafts, publish them, edit them later, and attach supporting files.</p>
    </section>

    ${renderLessonPlanForm(editingPlan)}
    ${renderLessonPlansTable(lessonPlans)}
  `;
}

/* =========================
   RENDER: LEARNERS
========================= */

function renderLearnersPage(students, notes) {
  const rows = students.map((student) => {
    const studentNotes = notes.filter(n => n.studentId === student.id);
    const latestNote = studentNotes[0]?.comment || 'No tutor comment yet';

    return `
      <tr>
        <td>${escapeHtml(student.full_name || student.name || 'Student')}</td>
        <td>${escapeHtml(student.email || '—')}</td>
        <td>${escapeHtml(student.classroomName || 'Not assigned')}</td>
        <td>${escapeHtml(latestNote)}</td>
        <td>
          <button
            class="btn add-note-btn"
            type="button"
            data-id="${escapeHtml(student.id)}"
            data-name="${escapeHtml(student.full_name || student.name || 'Student')}"
          >
            Add Comment
          </button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <section class="card panel">
      <h3>All Students</h3>
      <p>Every signed-in user with role student appears here automatically.</p>
      ${simpleTable(['Name', 'Email', 'Classroom', 'Latest Comment', 'Action'], rows)}
    </section>

    <section class="card panel" style="margin-top:18px">
      <h3>Add Tutor Comment</h3>
      <form id="learnerNoteForm" class="stack-form">
        <div class="form-row">
          <label for="noteStudentId">Student</label>
          <select id="noteStudentId" required>
            <option value="">Select student</option>
            ${students.map(student => `
              <option value="${escapeHtml(student.id)}">${escapeHtml(student.full_name || student.name || student.email || 'Student')}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-row">
          <label for="noteComment">Comment / Observation</label>
          <textarea id="noteComment" rows="5" placeholder="Enter learner note or progress comment"></textarea>
        </div>

        <div class="form-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button type="submit" class="btn" id="saveLearnerNoteBtn">Save Comment</button>
          <span id="learnerNoteMsg"></span>
        </div>
      </form>
    </section>
  `;
}

/* =========================
   RENDER: CLASSROOMS
========================= */

function renderClassroomsPage(classrooms, students) {
  const classroomRows = classrooms.map((item) => `
    <tr>
      <td>${escapeHtml(item.name || 'Untitled')}</td>
      <td>${escapeHtml(item.subject || '—')}</td>
      <td>${escapeHtml(item.description || '—')}</td>
      <td>${Array.isArray(item.studentIds) ? item.studentIds.length : 0}</td>
      <td>${fmtDate(item.createdAt)}</td>
      <td>
        <button class="btn classroom-delete-btn" type="button" data-id="${escapeHtml(item.id)}">Delete</button>
      </td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <h3>Create Classroom</h3>
      <form id="classroomForm" class="stack-form">
        <div class="form-row">
          <label for="classroomName">Classroom Name</label>
          <input id="classroomName" type="text" required placeholder="e.g. Grade 8 Mathematics">
        </div>

        <div class="form-row">
          <label for="classroomSubject">Subject</label>
          <input id="classroomSubject" type="text" required placeholder="e.g. Mathematics">
        </div>

        <div class="form-row">
          <label for="classroomDescription">Description</label>
          <textarea id="classroomDescription" rows="4" placeholder="Describe this classroom"></textarea>
        </div>

        <div class="form-row">
          <label for="classroomStudents">Select Students</label>
          <select id="classroomStudents" multiple size="8">
            ${students.map(student => `
              <option value="${escapeHtml(student.id)}">${escapeHtml(student.full_name || student.name || student.email || 'Student')}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button type="submit" class="btn" id="saveClassroomBtn">Save Classroom</button>
          <span id="classroomMsg"></span>
        </div>
      </form>
    </section>

    <section class="card panel" style="margin-top:18px">
      <h3>My Classrooms</h3>
      ${simpleTable(['Name', 'Subject', 'Description', 'Students', 'Created', 'Action'], classroomRows)}
    </section>
  `;
}

/* =========================
   RENDER: RESOURCES
========================= */

function renderResourcesPage(resources, classrooms, students) {
  const rows = resources.map((item) => `
    <tr>
      <td>${escapeHtml(item.title || 'Untitled')}</td>
      <td>${escapeHtml(item.type || 'File')}</td>
      <td>${escapeHtml(item.classroomName || '—')}</td>
      <td>${escapeHtml(item.studentName || '—')}</td>
      <td>${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" rel="noopener">Open</a>` : '—'}</td>
      <td>${fmtDate(item.createdAt)}</td>
      <td><button class="btn resource-delete-btn" type="button" data-id="${escapeHtml(item.id)}">Delete</button></td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <h3>Upload Resource</h3>
      <form id="resourceForm" class="stack-form">
        <div class="form-row">
          <label for="resourceTitle">Title</label>
          <input id="resourceTitle" type="text" required placeholder="Worksheet 1">
        </div>

        <div class="form-row">
          <label for="resourceType">Type</label>
          <input id="resourceType" type="text" placeholder="PDF, Video, Notes, Worksheet">
        </div>

        <div class="form-row">
          <label for="resourceClassroomId">Classroom</label>
          <select id="resourceClassroomId">
            <option value="">None</option>
            ${classrooms.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || 'Classroom')}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <label for="resourceStudentId">Student</label>
          <select id="resourceStudentId">
            <option value="">None</option>
            ${students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name || s.name || s.email || 'Student')}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <label for="resourceFile">File</label>
          <input id="resourceFile" type="file">
        </div>

        <div class="form-row">
          <label for="resourceNote">Description</label>
          <textarea id="resourceNote" rows="4" placeholder="Describe this resource"></textarea>
        </div>

        <div class="form-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button type="submit" class="btn" id="saveResourceBtn">Save Resource</button>
          <span id="resourceMsg"></span>
        </div>
      </form>
    </section>

    <section class="card panel" style="margin-top:18px">
      <h3>My Resources</h3>
      ${simpleTable(['Title', 'Type', 'Classroom', 'Student', 'File', 'Created', 'Action'], rows)}
    </section>
  `;
}

/* =========================
   RENDER: MESSAGES
========================= */

function renderMessagesPage(messages, students) {
  const rows = messages.map((item) => `
    <tr>
      <td>${escapeHtml(item.studentName || 'Student')}</td>
      <td>${escapeHtml(item.subject || 'No subject')}</td>
      <td>${escapeHtml(item.message || '—')}</td>
      <td>${fmtDate(item.createdAt)}</td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <h3>Send Message</h3>
      <form id="messageForm" class="stack-form">
        <div class="form-row">
          <label for="messageStudentId">Student</label>
          <select id="messageStudentId" required>
            <option value="">Select student</option>
            ${students.map(student => `
              <option value="${escapeHtml(student.id)}">${escapeHtml(student.full_name || student.name || student.email || 'Student')}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-row">
          <label for="messageSubject">Subject</label>
          <input id="messageSubject" type="text" placeholder="Message subject">
        </div>

        <div class="form-row">
          <label for="messageBody">Message</label>
          <textarea id="messageBody" rows="5" placeholder="Write your message"></textarea>
        </div>

        <div class="form-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button type="submit" class="btn" id="sendMessageBtn">Send Message</button>
          <span id="messageMsg"></span>
        </div>
      </form>
    </section>

    <section class="card panel" style="margin-top:18px">
      <h3>Sent Messages</h3>
      ${simpleTable(['Student', 'Subject', 'Message', 'Created'], rows)}
    </section>
  `;
}

/* =========================
   ACTIONS: STUDENT SUBMIT WORK
========================= */

async function submitStudentWork({ user, profile }) {
  const form = document.getElementById('submissionForm');
  const msg = document.getElementById('submitWorkMsg');
  const submitBtn = document.getElementById('submitWorkBtn');

  if (!form || !msg || !submitBtn) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const assignmentId = form.assignmentId.value.trim();
    const note = form.submissionNote.value.trim();
    const file = form.submissionFile.files?.[0] || null;

    if (!assignmentId) {
      msg.textContent = 'Please select an assignment.';
      return;
    }

    submitBtn.disabled = true;
    msg.textContent = 'Submitting...';

    try {
      const assignmentRef = doc(db, 'assignments', assignmentId);
      const assignmentSnap = await getDoc(assignmentRef);

      if (!assignmentSnap.exists()) {
        throw new Error('Selected assignment was not found.');
      }

      const assignment = assignmentSnap.data();
      const upload = await uploadFile(file, `submissions/${user.uid}`);

      const studentName = getStudentDisplayName(profile, user);
      const submissionRef = doc(collection(db, 'submissions'));

      const submissionPayload = {
        assignmentId,
        assignmentTitle: assignment.title || 'Untitled Assignment',
        subject: assignment.subject || '',
        tutorId: assignment.tutorId || assignment.createdBy || '',
        classroomId: assignment.classroomId || '',
        studentId: user.uid,
        studentName,
        studentEmail: user.email || '',
        note,
        fileUrl: upload.url || '',
        filePath: upload.path || '',
        fileName: upload.name || '',
        status: 'Submitted',
        grade: assignment.grade || '',
        feedback: '',
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const batch = writeBatch(db);

      batch.set(submissionRef, submissionPayload);

      batch.set(
        doc(db, 'assignments', assignmentId, 'submissions', user.uid),
        {
          submissionId: submissionRef.id,
          assignmentId,
          studentId: user.uid,
          studentName,
          studentEmail: user.email || '',
          note,
          fileUrl: upload.url || '',
          filePath: upload.path || '',
          fileName: upload.name || '',
          status: 'Submitted',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'students', user.uid, 'submissions', submissionRef.id),
        {
          submissionId: submissionRef.id,
          assignmentId,
          assignmentTitle: assignment.title || 'Untitled Assignment',
          subject: assignment.subject || '',
          tutorId: assignment.tutorId || assignment.createdBy || '',
          note,
          fileUrl: upload.url || '',
          filePath: upload.path || '',
          fileName: upload.name || '',
          status: 'Submitted',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'students', user.uid),
        {
          uid: user.uid,
          name: studentName,
          email: user.email || '',
          role: 'student',
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          name: studentName,
          full_name: studentName,
          email: user.email || '',
          role: 'student',
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      await batch.commit();

      msg.textContent = 'Work submitted successfully.';
      form.reset();

      const latestAssignments = await loadStudentAssignments(user.uid);
      const latestSubmissions = await loadStudentSubmissions(user.uid);

      document.getElementById('page-content').innerHTML = renderSubmitWorkPage(
        profile,
        user,
        latestAssignments,
        latestSubmissions
      );

      await submitStudentWork({ user, profile });
    } catch (error) {
      console.error('Submission error:', error);
      msg.textContent = error.message || 'Submission failed.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* =========================
   ACTIONS: LESSON PLANS
========================= */

async function saveLessonPlan({ user, profile, existingPlan = null }) {
  const form = document.getElementById('lessonPlanForm');
  const msg = document.getElementById('lessonPlanMsg');
  const btn = document.getElementById('createPlanBtn');

  if (!form || !msg || !btn) return;

  const cancelBtn = document.getElementById('cancelEditPlanBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      await refreshLessonPlansPage({ user, profile, editingPlanId: null });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const planId = form.planId.value.trim();
    const title = form.planTitle.value.trim();
    const subject = form.planSubject.value.trim();
    const classroomName = form.planClassroom.value.trim();
    const plannedDate = form.planDate.value;
    const objectives = form.planObjectives.value.trim();
    const materials = form.planMaterials.value.trim();
    const notes = form.planNotes.value.trim();
    const attachmentFile = form.planAttachment.files?.[0] || null;

    if (!title || !subject || !classroomName || !plannedDate) {
      msg.textContent = 'Please fill all required fields.';
      return;
    }

    btn.disabled = true;
    msg.textContent = planId ? 'Updating...' : 'Saving...';

    try {
      let attachmentUrl = existingPlan?.attachmentUrl || '';
      let attachmentPath = existingPlan?.attachmentPath || '';
      let attachmentName = existingPlan?.attachmentName || '';

      if (attachmentFile) {
        const upload = await uploadFile(attachmentFile, `lesson-plans/${user.uid}`);
        attachmentUrl = upload.url;
        attachmentPath = upload.path;
        attachmentName = upload.name;
      }

      const payload = {
        title,
        subject,
        classroomName,
        plannedDate,
        objectives,
        materials,
        notes,
        attachmentUrl,
        attachmentPath,
        attachmentName,
        tutorId: user.uid,
        tutorName: profile?.name || profile?.full_name || user.email || '',
        status: existingPlan?.status || 'Draft',
        updatedAt: serverTimestamp()
      };

      if (planId) {
        await updateDoc(doc(db, 'lesson-plans', planId), payload);
        msg.textContent = 'Lesson plan updated successfully.';
      } else {
        const planRef = doc(collection(db, 'lesson-plans'));
        await setDoc(planRef, {
          ...payload,
          status: 'Draft',
          createdAt: serverTimestamp()
        });
        msg.textContent = 'Lesson plan saved successfully.';
      }

      await refreshLessonPlansPage({ user, profile, editingPlanId: null });
    } catch (err) {
      console.error('Lesson plan save error:', err);
      msg.textContent = err.message || 'Failed to save lesson plan.';
    } finally {
      btn.disabled = false;
    }
  });
}

async function bindLessonPlanActions({ user, profile, lessonPlans }) {
  const editButtons = [...document.querySelectorAll('.plan-edit-btn')];
  const statusButtons = [...document.querySelectorAll('.plan-status-btn')];
  const deleteButtons = [...document.querySelectorAll('.plan-delete-btn')];

  editButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const planId = button.dataset.id;
      await refreshLessonPlansPage({ user, profile, editingPlanId: planId });
    });
  });

  statusButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const planId = button.dataset.id;
      const nextStatus = button.dataset.status || 'Published';

      try {
        await updateDoc(doc(db, 'lesson-plans', planId), {
          status: nextStatus,
          updatedAt: serverTimestamp()
        });
        await refreshLessonPlansPage({ user, profile, editingPlanId: null });
      } catch (err) {
        console.error('Lesson plan publish error:', err);
        alert(err.message || 'Failed to update lesson plan status.');
      }
    });
  });

  deleteButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const planId = button.dataset.id;
      const found = lessonPlans.find(item => item.id === planId);
      const ok = window.confirm(`Delete lesson plan "${found?.title || 'this plan'}"?`);

      if (!ok) return;

      try {
        await deleteDoc(doc(db, 'lesson-plans', planId));
        await refreshLessonPlansPage({ user, profile, editingPlanId: null });
      } catch (err) {
        console.error('Lesson plan delete error:', err);
        alert(err.message || 'Failed to delete lesson plan.');
      }
    });
  });
}

async function refreshLessonPlansPage({ user, profile, editingPlanId = null }) {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const lessonPlans = await loadTutorLessonPlans(user.uid);
  const editingPlan = editingPlanId
    ? lessonPlans.find(item => item.id === editingPlanId) || null
    : null;

  pageContent.innerHTML = renderLessonPlansPage(profile, lessonPlans, editingPlan);
  await saveLessonPlan({ user, profile, existingPlan: editingPlan });
  await bindLessonPlanActions({ user, profile, lessonPlans });
}

/* =========================
   ACTIONS: LEARNERS
========================= */

async function refreshLearnersPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const students = await loadAllStudents();
  const notes = await loadLearnerNotes(user.uid);

  pageContent.innerHTML = renderLearnersPage(students, notes);

  const form = document.getElementById('learnerNoteForm');
  const msg = document.getElementById('learnerNoteMsg');
  const studentSelect = document.getElementById('noteStudentId');
  const noteComment = document.getElementById('noteComment');

  document.querySelectorAll('.add-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      studentSelect.value = btn.dataset.id;
      noteComment.focus();
    });
  });

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const studentId = studentSelect.value;
    const comment = noteComment.value.trim();

    if (!studentId || !comment) {
      msg.textContent = 'Select a student and enter a comment.';
      return;
    }

    const student = students.find(s => s.id === studentId);
    const noteRef = doc(collection(db, 'student-notes'));

    await setDoc(noteRef, {
      tutorId: user.uid,
      studentId,
      studentName: student?.full_name || student?.name || student?.email || 'Student',
      comment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    msg.textContent = 'Comment saved.';
    await refreshLearnersPage(bundle);
  });
}

/* =========================
   ACTIONS: CLASSROOMS
========================= */

async function refreshClassroomsPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const classrooms = await loadClassrooms(user.uid);
  const students = await loadAllStudents();

  pageContent.innerHTML = renderClassroomsPage(classrooms, students);

  const form = document.getElementById('classroomForm');
  const msg = document.getElementById('classroomMsg');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('classroomName').value.trim();
      const subject = document.getElementById('classroomSubject').value.trim();
      const description = document.getElementById('classroomDescription').value.trim();
      const selectedOptions = [...document.getElementById('classroomStudents').selectedOptions];
      const studentIds = selectedOptions.map(opt => opt.value);

      if (!name || !subject) {
        msg.textContent = 'Enter classroom name and subject.';
        return;
      }

      const classroomRef = doc(collection(db, 'classrooms'));

      await setDoc(classroomRef, {
        tutorId: user.uid,
        name,
        subject,
        description,
        studentIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const batch = writeBatch(db);

      studentIds.forEach((studentId) => {
        batch.set(
          doc(db, 'users', studentId),
          {
            classroomId: classroomRef.id,
            classroomName: name,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );

        batch.set(
          doc(db, 'students', studentId),
          {
            classroomId: classroomRef.id,
            classroomName: name,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      });

      await batch.commit();

      msg.textContent = 'Classroom saved.';
      await refreshClassroomsPage(bundle);
    });
  }

  document.querySelectorAll('.classroom-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(doc(db, 'classrooms', btn.dataset.id));
      await refreshClassroomsPage(bundle);
    });
  });
}

/* =========================
   ACTIONS: RESOURCES
========================= */

async function refreshResourcesPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const resources = await loadResources(user.uid);
  const classrooms = await loadClassrooms(user.uid);
  const students = await loadAllStudents();

  pageContent.innerHTML = renderResourcesPage(resources, classrooms, students);

  const form = document.getElementById('resourceForm');
  const msg = document.getElementById('resourceMsg');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('resourceTitle').value.trim();
      const type = document.getElementById('resourceType').value.trim();
      const classroomId = document.getElementById('resourceClassroomId').value;
      const studentId = document.getElementById('resourceStudentId').value;
      const note = document.getElementById('resourceNote').value.trim();
      const file = document.getElementById('resourceFile').files?.[0] || null;

      if (!title) {
        msg.textContent = 'Enter resource title.';
        return;
      }

      const classroom = classrooms.find(c => c.id === classroomId);
      const student = students.find(s => s.id === studentId);
      const upload = await uploadFile(file, `resources/${user.uid}`);

      const resourceRef = doc(collection(db, 'resources'));

      await setDoc(resourceRef, {
        tutorId: user.uid,
        title,
        type,
        note,
        classroomId: classroomId || '',
        classroomName: classroom?.name || '',
        studentId: studentId || '',
        studentName: student?.full_name || student?.name || student?.email || '',
        fileUrl: upload.url || '',
        filePath: upload.path || '',
        fileName: upload.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      msg.textContent = 'Resource saved.';
      await refreshResourcesPage(bundle);
    });
  }

  document.querySelectorAll('.resource-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(doc(db, 'resources', btn.dataset.id));
      await refreshResourcesPage(bundle);
    });
  });
}

/* =========================
   ACTIONS: MESSAGES
========================= */

async function refreshMessagesPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const messages = await loadMessagesForTutor(user.uid);
  const students = await loadAllStudents();

  pageContent.innerHTML = renderMessagesPage(messages, students);

  const form = document.getElementById('messageForm');
  const msg = document.getElementById('messageMsg');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const studentId = document.getElementById('messageStudentId').value;
      const subject = document.getElementById('messageSubject').value.trim();
      const messageBody = document.getElementById('messageBody').value.trim();

      if (!studentId || !messageBody) {
        msg.textContent = 'Select student and enter a message.';
        return;
      }

      const student = students.find(s => s.id === studentId);
      const msgRef = doc(collection(db, 'messages'));

      await setDoc(msgRef, {
        tutorId: user.uid,
        studentId,
        studentName: student?.full_name || student?.name || student?.email || 'Student',
        subject,
        message: messageBody,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      msg.textContent = 'Message sent.';
      await refreshMessagesPage(bundle);
    });
  }
}

/* =========================
   BOOT PAGES
========================= */

async function bootSubmitWorkPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  if (bundle.profile?.role === 'student') {
    await ensureStudentMirror(bundle.user, bundle.profile);
  }

  const { user, profile } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const assignments = await loadStudentAssignments(user.uid);
  const submissions = await loadStudentSubmissions(user.uid);

  pageContent.innerHTML = renderSubmitWorkPage(profile, user, assignments, submissions);
  await submitStudentWork({ user, profile });
}

async function bootLessonPlansPage() {
  const bundle = await requireAuth();
  if (!bundle) return;
  await refreshLessonPlansPage(bundle);
}

async function bootLearnersPage() {
  const bundle = await requireAuth();
  if (!bundle) return;
  await refreshLearnersPage(bundle);
}

async function bootClassroomsPage() {
  const bundle = await requireAuth();
  if (!bundle) return;
  await refreshClassroomsPage(bundle);
}

async function bootResourcesPage() {
  const bundle = await requireAuth();
  if (!bundle) return;
  await refreshResourcesPage(bundle);
}

async function bootMessagesPage() {
  const bundle = await requireAuth();
  if (!bundle) return;
  await refreshMessagesPage(bundle);
}

async function bootDefaultPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  if (bundle.profile?.role === 'student') {
    await ensureStudentMirror(bundle.user, bundle.profile);
  }

  const pageContent = document.getElementById('page-content');
  if (pageContent) {
    pageContent.innerHTML = `
      <section class="card panel">
        <h3>${escapeHtml(pageTitle)}</h3>
        <p>This page is connected successfully.</p>
      </section>
    `;
  }
}

/* =========================
   GLOBALS
========================= */

window.AppUtil = {
  auth,
  db,
  storage,
  requireAuth,
  getUserProfile,
  uploadFile,
  fmtDate,
  statusBadge,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
};

/* =========================
   ROUTER
========================= */

if (pageKey === 'submit-work') {
  bootSubmitWorkPage();
} else if (pageKey === 'lesson-plans') {
  bootLessonPlansPage();
} else if (pageKey === 'learners') {
  bootLearnersPage();
} else if (pageKey === 'classrooms') {
  bootClassroomsPage();
} else if (pageKey === 'resources') {
  bootResourcesPage();
} else if (pageKey === 'messages') {
  bootMessagesPage();
} else {
  bootDefaultPage();
}
/* =====================================================
   NEW: PORTFOLIO + ANALYTICS + REPORT SYSTEM
   (APPENDED - DOES NOT REMOVE ANY OLD CODE)
===================================================== */

/* =========================
   PORTFOLIO (STUDENT)
========================= */

async function loadStudentPortfolio(studentId) {
  const snap = await getDocs(
    query(collection(db, 'portfolio'), where('studentId', '==', studentId))
  );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

function renderStudentPortfolio(items) {
  const rows = items.map(i => `
    <div class="card panel" style="margin-bottom:12px">
      <p><strong>Note:</strong> ${escapeHtml(i.note || '')}</p>
      <p><strong>Type:</strong> ${escapeHtml(i.type || 'file')}</p>
      <p><strong>Tag:</strong> ${escapeHtml(i.tag || 'general')}</p>
      ${i.fileUrl ? `<a href="${i.fileUrl}" target="_blank">View File</a>` : ''}
      <small>${fmtDate(i.createdAt)}</small>
    </div>
  `).join('');

  return `
    <section class="card panel">
      <h3>My Portfolio</h3>
      ${rows || '<p>No portfolio items yet</p>'}
    </section>

    <section class="card panel" style="margin-top:18px">
      <h3>Add Portfolio Item</h3>

      <form id="portfolioForm" class="stack-form">
        <div class="form-row">
          <label>Note</label>
          <textarea id="portfolioNote"></textarea>
        </div>

        <div class="form-row">
          <label>Tag</label>
          <select id="portfolioTag">
            <option value="high">High</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div class="form-row">
          <label>File</label>
          <input id="portfolioFile" type="file">
        </div>

        <button class="btn">Upload</button>
      </form>
    </section>
  `;
}

async function bootStudentPortfolio() {
  const { user, profile } = await requireAuth();

  const items = await loadStudentPortfolio(user.uid);

  document.getElementById('page-content').innerHTML =
    renderStudentPortfolio(items);

  document.getElementById('portfolioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const note = document.getElementById('portfolioNote').value;
    const tag = document.getElementById('portfolioTag').value;
    const file = document.getElementById('portfolioFile').files[0];

    const upload = await uploadFile(file, `portfolio/${user.uid}`);

    await setDoc(doc(collection(db, 'portfolio')), {
      studentId: user.uid,
      note,
      tag,
      fileUrl: upload.url,
      filePath: upload.path,
      createdAt: serverTimestamp()
    });

    bootStudentPortfolio();
  });
}


/* =========================
   TUTOR PORTFOLIO (FULL LIFE VIEW)
========================= */

async function bootTutorPortfolios() {
  const { user } = await requireAuth();

  const students = await loadAllStudents();

  let html = `<section class="card panel"><h3>Student Life Overview</h3>`;

  for (const s of students) {
    const portfolio = await loadStudentPortfolio(s.id);
    const assessments = await getDocs(query(collection(db,'assessments'), where('studentId','==',s.id)));
    const attendance = await getDocs(query(collection(db,'attendance'), where('studentId','==',s.id)));

    const highs = portfolio.filter(p => p.tag === 'high').length;
    const lows = portfolio.filter(p => p.tag === 'low').length;

    html += `
      <div class="card panel" style="margin-top:12px">
        <h4>${escapeHtml(s.full_name || s.name)}</h4>
        <p>Portfolio Items: ${portfolio.length}</p>
        <p>Highs: ${highs} | Lows: ${lows}</p>
        <p>Assessments: ${assessments.size}</p>
        <p>Attendance Records: ${attendance.size}</p>
      </div>
    `;
  }

  html += `</section>`;

  document.getElementById('page-content').innerHTML = html;
}


/* =========================
   REPORT SYSTEM
========================= */

async function bootReportsPage() {
  const { user } = await requireAuth();

  const students = await loadAllStudents();

  const rows = students.map(s => `
    <option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>
  `).join('');

  document.getElementById('page-content').innerHTML = `
    <section class="card panel">
      <h3>Create Report</h3>

      <form id="reportForm" class="stack-form">
        <select id="reportStudent">${rows}</select>

        <textarea id="reportStrengths" placeholder="Strengths"></textarea>
        <textarea id="reportLows" placeholder="Lows"></textarea>
        <textarea id="reportSummary" placeholder="Summary"></textarea>

        <button class="btn">Save</button>
      </form>
    </section>
  `;

  document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    await setDoc(doc(collection(db,'reports')), {
      studentId: reportStudent.value,
      strengths: reportStrengths.value,
      lows: reportLows.value,
      summary: reportSummary.value,
      createdAt: serverTimestamp()
    });

    alert("Report saved");
  });
}


/* =========================
   DASHBOARD (REAL ANALYTICS)
========================= */

async function bootDashboard() {
  const { user } = await requireAuth();

  const students = await loadAllStudents();
  const assignments = await getDocs(collection(db,'assignments'));
  const submissions = await getDocs(collection(db,'submissions'));

  document.getElementById('page-content').innerHTML = `
    <section class="card panel">
      <h3>Dashboard</h3>
      <p>Students: ${students.length}</p>
      <p>Assignments: ${assignments.size}</p>
      <p>Submissions: ${submissions.size}</p>
    </section>
  `;
}


/* =========================
   ROUTER EXTENSION (DO NOT REMOVE OLD ONE)
========================= */

if (pageKey === 'portfolio') {
  bootStudentPortfolio();
}
else if (pageKey === 'portfolios') {
  bootTutorPortfolios();
}
else if (pageKey === 'reports') {
  bootReportsPage();
}
else if (pageKey === 'dashboard') {
  bootDashboard();
}