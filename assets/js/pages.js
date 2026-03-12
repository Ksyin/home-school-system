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
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  orderBy,
  limit,
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
  return String(value ?? '')
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
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toLocaleDateString('en-GB', { dateStyle: 'medium' });
  try {
    return new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' });
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
    Draft: 'muted',
    Published: 'success',
    Present: 'success',
    Absent: 'danger'
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
          ${rowsHtml || `<tr><td colspan="${headers.length}"><div class="empty">No records found.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

async function getUserProfile(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? userDoc.data() : null;
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

      document.getElementById('app-shell').innerHTML = `
        ${sidebar({ ...profile, email: user.email })}
        <main class="content">
          ${uiHeader({ ...profile, email: user.email })}
          <div id="page-content"></div>
          <footer class="page-foot">HomeSchool Management System</footer>
        </main>
      `;

      document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await signOut(auth);
        location.href = '/login.html';
      });

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

  return { url, path: filePath, name: file.name };
}

// ────────────────────────────────────────────────
// STUDENT SUBMIT WORK (existing functionality)
// ────────────────────────────────────────────────

function getStudentDisplayName(profile, user) {
  return profile?.full_name || profile?.name || user?.displayName || user?.email || 'Student';
}

function normalizeAssignment(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

function assignmentVisibleToStudent(assignment, studentUid) {
  if (!assignment) return false;
  if (assignment.studentId === studentUid) return true;
  if (Array.isArray(assignment.studentIds) && assignment.studentIds.includes(studentUid)) return true;
  if (Array.isArray(assignment.assignedTo) && assignment.assignedTo.includes(studentUid)) return true;
  if (assignment.targetType === 'all_students') return true;
  if (assignment.published === true && !assignment.studentId && !assignment.studentIds && !assignment.assignedTo) return true;
  return false;
}

async function loadStudentAssignments(studentUid) {
  const snap = await getDocs(collection(db, 'assignments'));
  const all = snap.docs.map(normalizeAssignment);
  return all
    .filter(a => assignmentVisibleToStudent(a, studentUid))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function loadStudentSubmissions(studentUid) {
  const q = query(collection(db, 'submissions'), where('studentId', '==', studentUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

function renderSubmitWorkPage(profile, user, assignments, submissions) {
  const name = getStudentDisplayName(profile, user);

  const options = assignments.map(a => `
    <option value="${escapeHtml(a.id)}">${escapeHtml(a.title || 'Untitled')} ${a.subject ? ` - ${escapeHtml(a.subject)}` : ''}</option>
  `).join('');

  const rows = submissions.map(s => `
    <tr>
      <td>${escapeHtml(s.assignmentTitle || '—')}</td>
      <td>${escapeHtml(s.subject || '—')}</td>
      <td>${statusBadge(s.status || 'Submitted')}</td>
      <td>${fmtDate(s.submittedAt)}</td>
      <td>${s.fileUrl ? `<a href="${s.fileUrl}" target="_blank">View</a>` : '—'}</td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <h3>Submit Assignment</h3>
      <p>Welcome, ${escapeHtml(name)}. Choose an assignment and submit your work.</p>

      <form id="submissionForm" class="stack-form">
        <div class="form-row">
          <label for="assignmentId">Assignment</label>
          <select id="assignmentId" name="assignmentId" required>
            <option value="">Select assignment</option>
            ${options}
          </select>
        </div>
        <div class="form-row">
          <label for="submissionNote">Notes</label>
          <textarea id="submissionNote" name="submissionNote" rows="4" placeholder="Optional notes..."></textarea>
        </div>
        <div class="form-row">
          <label for="submissionFile">File</label>
          <input type="file" id="submissionFile" name="submissionFile">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary" id="submitWorkBtn">Submit Work</button>
          <span id="submitWorkMsg" style="margin-left:12px;"></span>
        </div>
      </form>
    </section>

    <section class="card panel" style="margin-top:20px;">
      <h3>Previous Submissions</h3>
      ${simpleTable(['Assignment', 'Subject', 'Status', 'Submitted', 'File'], rows)}
    </section>
  `;
}

async function submitStudentWork({ user, profile }) {
  const form = document.getElementById('submissionForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const msgEl = document.getElementById('submitWorkMsg');
    const btn = document.getElementById('submitWorkBtn');
    btn.disabled = true;
    msgEl.textContent = 'Submitting...';

    try {
      const assignmentId = form.assignmentId.value.trim();
      if (!assignmentId) throw new Error('Please select an assignment');

      const assignmentSnap = await getDoc(doc(db, 'assignments', assignmentId));
      if (!assignmentSnap.exists()) throw new Error('Assignment not found');

      const assignment = assignmentSnap.data();
      const file = form.submissionFile.files[0];
      const upload = await uploadFile(file, `submissions/${user.uid}`);

      const studentName = getStudentDisplayName(profile, user);
      const submissionRef = doc(collection(db, 'submissions'));

      const batch = writeBatch(db);

      const payload = {
        assignmentId,
        assignmentTitle: assignment.title || 'Untitled',
        subject: assignment.subject || '',
        tutorId: assignment.tutorId || assignment.createdBy || '',
        classroomId: assignment.classroomId || '',
        studentId: user.uid,
        studentName,
        studentEmail: user.email || '',
        note: form.submissionNote.value.trim(),
        fileUrl: upload.url,
        filePath: upload.path,
        fileName: upload.name,
        status: 'Submitted',
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(submissionRef, payload);

      batch.set(doc(db, 'assignments', assignmentId, 'submissions', user.uid), {
        submissionId: submissionRef.id,
        ...payload
      }, { merge: true });

      batch.set(doc(db, 'students', user.uid, 'submissions', submissionRef.id), {
        submissionId: submissionRef.id,
        assignmentId,
        assignmentTitle: assignment.title || 'Untitled',
        subject: assignment.subject || '',
        tutorId: assignment.tutorId || '',
        note: payload.note,
        fileUrl: upload.url,
        filePath: upload.path,
        fileName: upload.name,
        status: 'Submitted',
        submittedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();

      msgEl.textContent = 'Submitted successfully!';
      form.reset();

      // Refresh content
      const assignments = await loadStudentAssignments(user.uid);
      const submissions = await loadStudentSubmissions(user.uid);
      document.getElementById('page-content').innerHTML = renderSubmitWorkPage(profile, user, assignments, submissions);
      await submitStudentWork({ user, profile }); // re-attach listener
    } catch (err) {
      console.error(err);
      msgEl.textContent = err.message || 'Failed to submit';
    } finally {
      btn.disabled = false;
    }
  });
}

async function bootSubmitWorkPage() {
  const { user, profile } = await requireAuth();
  const content = document.getElementById('page-content');
  if (!content) return;

  const assignments = await loadStudentAssignments(user.uid);
  const submissions = await loadStudentSubmissions(user.uid);

  content.innerHTML = renderSubmitWorkPage(profile, user, assignments, submissions);
  await submitStudentWork({ user, profile });
}

// ────────────────────────────────────────────────
// TUTOR LESSON PLANS
// ────────────────────────────────────────────────

function normalizeLessonPlan(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

async function loadTutorLessonPlans(tutorUid) {
  const classroomsSnap = await getDocs(
    query(collection(db, 'classrooms'), where('tutorId', '==', tutorUid))
  );

  const plans = [];

  for (const cDoc of classroomsSnap.docs) {
    const classroomId = cDoc.id;
    const classroomName = cDoc.data()?.name || 'Unnamed';

    const plansSnap = await getDocs(
      collection(db, 'classrooms', classroomId, 'lessonPlans')
    );

    plansSnap.forEach(pDoc => {
      const plan = normalizeLessonPlan(pDoc);
      plan.classroomId = classroomId;
      plan.classroomName = classroomName;
      plans.push(plan);
    });
  }

  return plans.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

function renderLessonPlansPage(lessonPlans = []) {
  const rows = lessonPlans.map(p => `
    <tr>
      <td>${escapeHtml(p.title || 'Untitled')}</td>
      <td>${escapeHtml(p.subject || '—')}</td>
      <td>${escapeHtml(p.classroomName || '—')}</td>
      <td>${p.week ? `Week ${p.week}` : fmtDate(p.startDate || p.createdAt)}</td>
      <td>${statusBadge(p.status || 'Draft')}</td>
      <td>
        <button class="btn small view-plan" data-id="${p.id}" data-classroom="${p.classroomId}">View</button>
      </td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <div class="flex-between" style="margin-bottom:1rem;">
        <h3>Lesson Plans</h3>
        <button class="btn primary" id="btnNewLessonPlan">+ New Lesson Plan</button>
      </div>

      ${simpleTable(
        ['Title', 'Subject', 'Classroom', 'Week / Date', 'Status', 'Actions'],
        rows
      )}
    </section>

    <div id="lessonPlanStatus" style="margin-top:1rem; min-height:1.5rem;"></div>
  `;
}

// Temporary MVP creation using prompts
// → Replace this function with proper modal/form later
async function createLessonPlanMVP({ user, profile }) {
  const title = prompt("Lesson title:", "Week X - ")?.trim();
  if (!title) return;

  const subject = prompt("Subject:", "Mathematics")?.trim() || "General";

  const classroomsSnap = await getDocs(
    query(collection(db, 'classrooms'), where('tutorId', '==', user.uid), limit(1))
  );

  if (classroomsSnap.empty) {
    alert("No classrooms found. Create a classroom first.");
    return;
  }

  const classroomId = classroomsSnap.docs[0].id;

  const statusEl = document.getElementById('lessonPlanStatus');
  statusEl.textContent = 'Creating...';

  try {
    const ref = doc(collection(db, 'classrooms', classroomId, 'lessonPlans'));

    await setDoc(ref, {
      title,
      subject,
      tutorId: user.uid,
      tutorName: profile.name || profile.full_name || user.email || 'Tutor',
      status: 'Draft',
      week: null,
      objectives: [],
      materials: [],
      activities: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    statusEl.textContent = 'Lesson plan created!';
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + (err.message || 'failed');
  }
}

async function bootLessonPlansPage() {
  const { user, profile } = await requireAuth();
  const content = document.getElementById('page-content');
  if (!content) return;

  try {
    const plans = await loadTutorLessonPlans(user.uid);
    content.innerHTML = renderLessonPlansPage(plans);

    document.getElementById('btnNewLessonPlan')?.addEventListener('click', () =>
      createLessonPlanMVP({ user, profile })
    );

    // Placeholder for view/edit
    document.querySelectorAll('.view-plan').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const cid = btn.dataset.classroom;
        alert(`View lesson plan:\nID: ${id}\nClassroom: ${cid}\n\n(Implement detail view / edit here)`);
      });
    });
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="card error">Failed to load lesson plans: ${err.message}</div>`;
  }
}

// ────────────────────────────────────────────────
// DEFAULT / FALLBACK PAGE
// ────────────────────────────────────────────────

function bootDefaultPage() {
  requireAuth().then(({ profile }) => {
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = `
        <section class="card panel">
          <h3>${escapeHtml(pageTitle)}</h3>
          <p>Page loaded successfully.</p>
        </section>
      `;
    }
  });
}

// ────────────────────────────────────────────────
// PAGE ROUTER
// ────────────────────────────────────────────────

if (pageKey === 'submit-work') {
  bootSubmitWorkPage();
} else if (pageKey === 'lesson-plans') {
  bootLessonPlansPage();
} else {
  bootDefaultPage();
}