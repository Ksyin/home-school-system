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
  if (!file) {
    return { url: '', path: '', name: '' };
  }

  const CLOUD_NAME = 'djqqcepe8';
  const UPLOAD_PRESET = 'homeschool';

  try {
    console.log('📤 Uploading to Cloudinary...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data?.error?.message || 'Upload failed');
    }

    console.log('✅ Upload success:', data.secure_url);

    return {
      url: data.secure_url,
      path: data.public_id,
      name: file.name
    };

  } catch (err) {
    console.error('❌ Upload failed:', err);
    throw err;
  }
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
  console.log('📝 Loading assignments for student:', studentUid);
  
  // Get student's classroom info
  const studentDoc = await getDoc(doc(db, 'students', studentUid));
  const studentData = studentDoc.data();
  const classroomId = studentData?.classroomId || '';
  
  const assignmentsSnap = await getDocs(collection(db, 'assignments'));
  const assignments = [];
  
  for (const docSnap of assignmentsSnap.docs) {
    const assignment = { id: docSnap.id, ...docSnap.data() };
    
    let isVisible = false;
    
    // Direct assignment to student
    if (assignment.studentId === studentUid) isVisible = true;
    
    // Assignment to student's classroom
    if (assignment.classroomId === classroomId) isVisible = true;
    
    // Assignment to all students (published)
    if (assignment.targetType === 'all_students' || assignment.published === true) {
      isVisible = true;
    }
    
    // Student is in assignedTo array
    if (Array.isArray(assignment.assignedTo) && assignment.assignedTo.includes(studentUid)) {
      isVisible = true;
    }
    
    if (isVisible) {
      assignments.push(assignment);
    }
  }
  
  assignments.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  
  console.log(`✅ Loaded ${assignments.length} assignments for student`);
  return assignments;
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
  
  // Create a map of submitted assignments
  const submittedMap = new Map();
  submissions.forEach(sub => {
    submittedMap.set(sub.assignmentId, sub);
  });
  
  // Filter out assignments that are already submitted
  const pendingAssignments = assignments.filter(a => !submittedMap.has(a.id));
  const completedCount = submissions.length;
  const pendingCount = pendingAssignments.length;
  
  const options = pendingAssignments.map(item => `
    <option value="${escapeHtml(item.id)}">
      ${escapeHtml(item.title || 'Untitled Assignment')} 
      ${item.subject ? `- ${escapeHtml(item.subject)}` : ''}
      ${item.dueDate ? ` (Due: ${fmtDate(item.dueDate)})` : ''}
    </option>
  `).join('');
  
  const submissionRows = submissions.map(item => `
    <tr>
      <td>${escapeHtml(item.assignmentTitle || 'Assignment')}</td>
      <td>${escapeHtml(item.subject || '—')}</td>
      <td>${statusBadge(item.status || 'Submitted')}</td>
      <td>${fmtDate(item.submittedAt)}</td>
      <td>
        ${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" rel="noopener" class="btn small">📎 View</a>` : '—'}
        ${item.fileUrl ? `<a href="${item.fileUrl}" download class="btn small ghost">⬇️ Download</a>` : ''}
      </td>
    </tr>
  `).join('');
  
  return `
    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
      <div class="card stat primary" style="text-align: center;">
        <h3 style="font-size: 32px; margin: 0;">${assignments.length}</h3>
        <p>Total Assignments</p>
      </div>
      <div class="card stat success" style="text-align: center;">
        <h3 style="font-size: 32px; margin: 0;">${completedCount}</h3>
        <p>Completed</p>
      </div>
      <div class="card stat warn" style="text-align: center;">
        <h3 style="font-size: 32px; margin: 0;">${pendingCount}</h3>
        <p>Pending</p>
      </div>
    </div>
    
    <section class="card panel">
      <h3>📤 Submit Assignment</h3>
      <p>Welcome, ${escapeHtml(studentName)}. Select an assignment, attach your work, and submit it.</p>
      
      ${pendingAssignments.length === 0 ? `
        <div class="success-message" style="background: #d4edda; padding: 16px; border-radius: 8px; text-align: center;">
          🎉 Great job! You've submitted all your assignments.
        </div>
      ` : `
        <form id="submissionForm" class="stack-form">
          <div class="form-row">
            <label for="assignmentId">Select Assignment *</label>
            <select id="assignmentId" name="assignmentId" required>
              <option value="">-- Choose an assignment --</option>
              ${options}
            </select>
          </div>
          
          <div class="form-row">
            <label for="submissionNote">Message / Notes (optional)</label>
            <textarea id="submissionNote" name="submissionNote" rows="4" placeholder="Add any notes about your work..."></textarea>
          </div>
          
          <div class="form-row">
            <label for="submissionFile">Attach File</label>
            <div id="dragArea" class="drag-area">
              📁 Drag & drop your file here or click to browse
              <input id="submissionFile" name="submissionFile" type="file" style="display: none;">
            </div>
            <div id="selectedFileDisplay" class="selected-file"></div>
          </div>
          
          <div class="form-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <button type="submit" class="btn" id="submitWorkBtn">📤 Submit Work</button>
            <span id="submitWorkMsg"></span>
          </div>
        </form>
      `}
    </section>
    
    ${submissions.length > 0 ? `
      <section class="card panel" style="margin-top:18px">
        <h3>📋 My Previous Submissions</h3>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Attachment</th>
              </tr>
            </thead>
            <tbody>
              ${submissionRows}
            </tbody>
          </table>
        </div>
      </section>
    ` : ''}
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


function renderFilePreview(url, name = '') {
  if (!url) return '—';

  const lower = (name || url).toLowerCase();

  // 🖼 IMAGE
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        <img src="${url}" style="width:140px;height:100px;object-fit:cover;border-radius:10px;cursor:pointer"
          onclick="openFileModal('${url}', 'image', '${name}')">

        <button class="btn"
          onclick="openFileModal('${url}', 'image', '${name}')">
          View
        </button>
      </div>
    `;
  }

  // 📄 PDF + DOC + DOCX (FIXED)
  if (lower.match(/\.(pdf|doc|docx)$/)) {
    return `
      <div style="display:flex;flex-direction:column;gap:10px">

        <div style="
          width:140px;
          height:100px;
          background:#f1f5ff;
          border-radius:10px;
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          font-weight:bold;
        "
        onclick="openFileModal('${url}', 'doc', '${name}')">
          📄 Document
        </div>

        <button class="btn"
          onclick="openFileModal('${url}', 'doc', '${name}')">
          Read
        </button>

        <a href="${url}" target="_blank" class="btn ghost">
          Open tab
        </a>

        <a href="${url}" download class="btn ghost">
          Download
        </a>
      </div>
    `;
  }

  // 🎥 VIDEO
  if (lower.match(/\.(mp4|webm|ogg)$/)) {
    return `
      <video controls style="width:140px;border-radius:10px">
        <source src="${url}">
      </video>
    `;
  }

  // DEFAULT
  return `
    <button class="btn"
      onclick="openFileModal('${url}', 'file', '${name}')">
      Open
    </button>
  `;
}

function openFileModal(url, type, name = '') {
  const old = document.getElementById('fileModal');
  if (old) old.remove();

  let content = '';

  // IMAGE
  if (type === 'image') {
    content = `<img src="${url}" style="max-width:100%;max-height:80vh">`;
  }

  // 🔥 DOCUMENT (PDF + DOC FIXED HERE)
  else if (type === 'doc') {
    content = `
      <iframe 
        src="https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}"
        style="width:100%;height:80vh;border:none">
      </iframe>
    `;
  }

  // VIDEO
  else if (type === 'video') {
    content = `
      <video controls style="width:100%">
        <source src="${url}">
      </video>
    `;
  }

  // DEFAULT
  else {
    content = `
      <iframe src="${url}" style="width:100%;height:80vh"></iframe>
    `;
  }

  const modal = document.createElement('div');
  modal.id = 'fileModal';

  modal.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      background:rgba(0,0,0,0.7);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:9999;
    ">
      <div style="
        width:90%;
        max-width:1000px;
        background:#fff;
        padding:16px;
        border-radius:12px;
      ">

        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <strong>${name || 'Preview'}</strong>
          <button onclick="document.getElementById('fileModal').remove()" class="btn danger">Close</button>
        </div>

        ${content}

        <div style="margin-top:10px;display:flex;gap:10px">
          <a href="${url}" target="_blank" class="btn">Open</a>
          <a href="${url}" download class="btn ghost">Download</a>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}


/* =========================
   STUDENT-SIDE LOADERS
========================= */

async function loadStudentResources(studentUid) {
  console.log('📚 Loading resources for student:', studentUid);
  
  // First, get the student's classroom info
  const studentDoc = await getDoc(doc(db, 'students', studentUid));
  const studentData = studentDoc.data();
  const classroomId = studentData?.classroomId || '';
  const classroomName = studentData?.classroomName || '';
  
  console.log('🏫 Student classroom:', classroomId, classroomName);
  
  // Get ALL resources from Firestore
  const resourcesSnap = await getDocs(collection(db, 'resources'));
  
  const resources = [];
  
  for (const docSnap of resourcesSnap.docs) {
    const resource = { id: docSnap.id, ...docSnap.data() };
    
    // Check if this resource is visible to the student
    let isVisible = false;
    
    // 1. Global resource (no restrictions)
    if (!resource.studentId && !resource.classroomId) {
      isVisible = true;
    }
    
    // 2. Directly assigned to this student
    if (resource.studentId === studentUid) {
      isVisible = true;
    }
    
    // 3. Assigned to student's classroom
    if (resource.classroomId && resource.classroomId === classroomId) {
      isVisible = true;
    }
    
    // 4. Assigned by classroom name match
    if (resource.classroomName && resource.classroomName === classroomName) {
      isVisible = true;
    }
    
    // 5. No restrictions - treat as global
    if (!resource.studentId && !resource.classroomId && !resource.classroomName) {
      isVisible = true;
    }
    
    if (isVisible) {
      resources.push(resource);
    }
  }
  
  // Sort by newest first
  resources.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  
  console.log(`✅ Loaded ${resources.length} resources for student`);
  return resources;
}

async function loadStudentAssessments(studentUid) {
  const snap = await getDocs(collection(db, 'assessments'));

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => {
      if (item.studentId && item.studentId === studentUid) return true;
      if (Array.isArray(item.studentIds) && item.studentIds.includes(studentUid)) return true;
      return false;
    })
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

async function loadStudentReports(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'reports'), where('studentId', '==', studentUid))
  );

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

async function loadStudentActivities(studentUid) {
  const notesSnap = await getDocs(
    query(collection(db, 'student-notes'), where('studentId', '==', studentUid))
  );

  const portfolioSnap = await getDocs(
    query(collection(db, 'portfolio'), where('studentId', '==', studentUid))
  );

  const noteItems = notesSnap.docs.map(d => ({
    id: d.id,
    type: 'Tutor Note',
    title: d.data().comment || 'Tutor note',
    createdAt: d.data().createdAt || null,
    raw: d.data()
  }));

  const portfolioItems = portfolioSnap.docs.map(d => ({
    id: d.id,
    type: 'Portfolio',
    title: d.data().note || d.data().tag || 'Portfolio item',
    createdAt: d.data().createdAt || null,
    raw: d.data()
  }));

  return [...noteItems, ...portfolioItems].sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

async function loadStudentMessages(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'messages'), where('studentId', '==', studentUid))
  );

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

/* =========================
   RENDER: STUDENT DASHBOARD
========================= */

function renderStudentDashboard(profile, assignments, submissions, resources, reports, portfolioItems) {
  const pendingAssignments = Math.max(assignments.length - submissions.length, 0);

  const recentRows = submissions.slice(0, 5).map(item => `
    <tr>
      <td>${escapeHtml(item.assignmentTitle || 'Assignment')}</td>
      <td>${statusBadge(item.status || 'Submitted')}</td>
      <td>${fmtDate(item.submittedAt)}</td>
    </tr>
  `).join('');

  return `
    <section class="grid cols-4 gap-4">
      <div class="card stat primary">
        <h3>${assignments.length}</h3>
        <p>Assignments</p>
      </div>

      <div class="card stat success">
        <h3>${submissions.length}</h3>
        <p>Submitted</p>
      </div>

      <div class="card stat warn">
        <h3>${pendingAssignments}</h3>
        <p>Pending</p>
      </div>

      <div class="card stat danger">
        <h3>${reports.length}</h3>
        <p>Reports</p>
      </div>
    </section>

    <section class="card panel" style="margin-top:20px">
      <h3>Welcome ${escapeHtml(profile?.full_name || profile?.name || 'Student')}</h3>
      <p>You currently have <strong>${resources.length}</strong> resources and <strong>${portfolioItems.length}</strong> portfolio entries.</p>
    </section>

    <section class="card panel" style="margin-top:20px">
      <h3>Recent Submissions</h3>
      ${simpleTable(['Assignment', 'Status', 'Submitted'], recentRows)}
    </section>
  `;
}

async function submitStudentPortfolio({ user, profile }) {

  const form = document.getElementById('portfolioForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = document.getElementById('portfolioType').value;
    const title = document.getElementById('portfolioTitle').value.trim();
    const note = document.getElementById('portfolioNote').value.trim();
    const file = document.getElementById('portfolioFile').files?.[0];

    if (!title && !note && !file) return;

    const upload = await uploadFile(file, `portfolio/${user.uid}`);

    await setDoc(doc(collection(db, 'portfolio')), {
      studentId: user.uid,
      studentName: getStudentDisplayName(profile, user),

      type,
      title,
      note,

      fileUrl: upload.url,
      fileName: upload.name,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // clear form
    form.reset();

    // reload UI
    await refreshStudentPortfolioPage({ user, profile });

  });
}

async function refreshStudentPortfolioPage(bundle) {
  const { user, profile } = bundle;
  const pageContent = document.getElementById('page-content');

  const items = await loadStudentPortfolio(user.uid);

  pageContent.innerHTML = renderStudentPortfolioPage(items);

  await submitStudentPortfolio({ user, profile });
}

/* =========================
   RENDER: STUDENT ASSIGNMENTS
========================= */

function renderStudentAssignmentsPage(assignments, submissions) {
  const submittedMap = new Map(
    submissions.map(item => [item.assignmentId, item])
  );

  const rows = assignments.map(item => {
    const submission = submittedMap.get(item.id);

    return `
      <tr>
        <td><strong>${escapeHtml(item.title || 'Untitled')}</strong></td>
        <td>${escapeHtml(item.subject || '—')}</td>
        <td>${escapeHtml(item.description || 'No instructions')}</td>
        <td>${item.dueDate ? fmtDate(item.dueDate) : '—'}</td>
        <td>${submission ? statusBadge(submission.status || 'Submitted') : statusBadge('Pending')}</td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn" href="/student/submit-work.html?assignmentId=${encodeURIComponent(item.id)}">Do Task</a>
            ${submission?.fileUrl ? `<a class="btn ghost" href="${submission.fileUrl}" target="_blank" rel="noopener">My File</a>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <section class="card panel">
      <h3>My Assignments</h3>
      ${simpleTable(['Title', 'Subject', 'Instructions', 'Due', 'Status', 'Action'], rows)}
    </section>
  `;
}

/* =========================
   RENDER: STUDENT RESOURCES
========================= */
function renderStudentResourcesPage(resources) {
  if (!resources || resources.length === 0) {
    return `
      <section class="card panel">
        <h3>📚 Learning Resources</h3>
        <div class="empty-state" style="text-align: center; padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
          <h4>No resources yet</h4>
          <p>Your tutor hasn't shared any resources with you yet. Check back later!</p>
        </div>
      </section>
    `;
  }
  
  const resourcesHtml = resources.map(resource => `
    <div class="resource-card">
      <div class="resource-header">
        <strong class="resource-title">${escapeHtml(resource.title || 'Untitled')}</strong>
        <span class="resource-type">${escapeHtml(resource.type || 'Resource')}</span>
      </div>
      ${resource.note ? `<div class="resource-description">${escapeHtml(resource.note)}</div>` : ''}
      ${resource.fileUrl ? `
        <div class="file-preview">
          ${renderFilePreview(resource.fileUrl, resource.fileName || resource.title)}
        </div>
      ` : ''}
      <div class="resource-meta">
        Shared: ${fmtDate(resource.createdAt)}
        ${resource.classroomName ? ` • Classroom: ${escapeHtml(resource.classroomName)}` : ''}
      </div>
    </div>
  `).join('');
  
  return `
    <section class="card panel">
      <h3>📚 Learning Resources (${resources.length})</h3>
      <p>Resources shared by your tutor appear here.</p>
      <div style="margin-top: 20px;">
        ${resourcesHtml}
      </div>
    </section>
  `;
}


/* =========================
   RENDER: STUDENT ASSESSMENTS
========================= */

function renderStudentAssessmentsPage(items) {
  const rows = items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.title || item.name || 'Assessment')}</strong></td>
      <td>${escapeHtml(item.subject || '—')}</td>
      <td>${escapeHtml(item.score || item.grade || '—')}</td>
      <td>${escapeHtml(item.feedback || item.comment || '—')}</td>
      <td>${fmtDate(item.createdAt)}</td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <h3>My Assessments</h3>
      ${simpleTable(['Title', 'Subject', 'Score', 'Feedback', 'Created'], rows)}
    </section>
  `;
}

/* =========================
   RENDER: STUDENT REPORTS
========================= */

function renderStudentReportsPage(items) {
  const rows = items.map(item => `
    <div class="card panel" style="margin-bottom:12px">
      <h4>${escapeHtml(item.title || 'Report')}</h4>
      <p><strong>Strengths:</strong> ${escapeHtml(item.strengths || '—')}</p>
      <p><strong>Challenges:</strong> ${escapeHtml(item.lows || '—')}</p>
      <p><strong>Summary:</strong> ${escapeHtml(item.summary || item.comment || '—')}</p>
      <small>${fmtDate(item.createdAt)}</small>
    </div>
  `).join('');

  return `
    <section class="card panel">
      <h3>My Reports</h3>
      ${items.length ? rows : '<div class="empty">No reports yet.</div>'}
    </section>
  `;
}

/* =========================
   RENDER: STUDENT ACTIVITIES
========================= */

function renderStudentActivitiesPage(items) {
  const rows = items.map(item => `
    <div class="card panel" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <strong>${escapeHtml(item.type)}</strong>
        <small>${fmtDate(item.createdAt)}</small>
      </div>
      <p style="margin-top:10px">${escapeHtml(item.title || '—')}</p>
    </div>
  `).join('');

  return `
    <section class="card panel">
      <h3>My Activities</h3>
      ${items.length ? rows : '<div class="empty">No activities yet.</div>'}
    </section>
  `;
}

/* =========================
   RENDER: STUDENT MESSAGES
========================= */

function renderStudentMessagesPage(messages) {
  const rows = messages.map(item => `
    <div class="card panel" style="margin-bottom:12px">
      <h4>${escapeHtml(item.subject || 'Message')}</h4>
      <p>${escapeHtml(item.message || '—')}</p>
      <small>${fmtDate(item.createdAt)}</small>
    </div>
  `).join('');

  return `
    <section class="card panel">
      <h3>Messages from Tutor</h3>
      ${messages.length ? rows : '<div class="empty">No messages yet.</div>'}
    </section>
  `;
}

/* =========================
   STUDENT PAGE REFRESHERS
========================= */

async function refreshStudentDashboard(bundle) {
  const { user, profile } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const [assignments, submissions, resources, reports, portfolioItems] = await Promise.all([
    loadStudentAssignments(user.uid),
    loadStudentSubmissions(user.uid),
    loadStudentResources(user.uid),
    loadStudentReports(user.uid),
    loadStudentPortfolio(user.uid)
  ]);

  pageContent.innerHTML = renderStudentDashboard(
    profile,
    assignments,
    submissions,
    resources,
    reports,
    portfolioItems
  );
}

async function refreshStudentAssignmentsPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const [assignments, submissions] = await Promise.all([
    loadStudentAssignments(user.uid),
    loadStudentSubmissions(user.uid)
  ]);

  pageContent.innerHTML = renderStudentAssignmentsPage(assignments, submissions);
}

async function refreshStudentResourcesPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const resources = await loadStudentResources(user.uid);
  pageContent.innerHTML = renderStudentResourcesPage(resources);
}

async function refreshStudentAssessmentsPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const items = await loadStudentAssessments(user.uid);
  pageContent.innerHTML = renderStudentAssessmentsPage(items);
}

async function refreshStudentReportsPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const items = await loadStudentReports(user.uid);
  pageContent.innerHTML = renderStudentReportsPage(items);
}

async function refreshStudentActivitiesPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const items = await loadStudentActivities(user.uid);
  pageContent.innerHTML = renderStudentActivitiesPage(items);
}

async function refreshStudentMessagesPage(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const messages = await loadStudentMessages(user.uid);
  pageContent.innerHTML = renderStudentMessagesPage(messages);
}



/* =========================
   RENDER: RESOURCES (NEW & IMPROVED)
========================= */

function renderResourcesPage(resources, classrooms, students) {
  const rowsHtml = resources.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.title || 'Untitled')}</strong></td>
      <td>${escapeHtml(item.type || 'File')}</td>
      <td>${escapeHtml(item.classroomName || '—')}</td>
      <td>${escapeHtml(item.studentName || '—')}</td>

      <td>
        ${item.fileUrl 
          ? renderFilePreview(item.fileUrl, item.fileName) 
          : '—'
        }
      </td>

      <td>${fmtDate(item.createdAt)}</td>

      <td>
        <button class="btn danger resource-delete-btn" type="button" data-id="${escapeHtml(item.id)}">
          Delete
        </button>
      </td>
    </tr>

    <tr class="details-row">
      <td colspan="7">
        <div style="padding:14px; background:var(--surface-2); border-radius:12px;">
          <strong>Description:</strong> ${escapeHtml(item.note || 'No description')}<br>
          ${item.fileName ? `<strong>File:</strong> ${escapeHtml(item.fileName)}` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <section class="card panel">
      <h3>📚 Upload New Resource</h3>

      <form id="resourceForm" class="stack-form">

        <div class="form-row">
          <label>Title *</label>
          <input id="resourceTitle" required>
        </div>

        <div class="form-row">
          <label>Type</label>
          <input id="resourceType">
        </div>

        <div class="form-row">
          <label>Classroom</label>
          <select id="resourceClassroomId">
            <option value="">None</option>
            ${classrooms.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <label>Student</label>
          <select id="resourceStudentId">
            <option value="">None</option>
            ${students.map(s => `<option value="${s.id}">${s.full_name || s.email}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <label>File</label>
          <input id="resourceFile" type="file">
        </div>

        <div class="form-row">
          <label>Description</label>
          <textarea id="resourceNote"></textarea>
        </div>

        <button class="btn" id="saveResourceBtn">Upload</button>
        <span id="resourceMsg"></span>
      </form>
    </section>

    <section class="card panel" style="margin-top:20px">
      <h3>Resources (${resources.length})</h3>
      ${simpleTable(
        ['Title','Type','Classroom','Student','File','Created','Action'],
        rowsHtml
      )}
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
    const note = form.submissionNote?.value?.trim() || '';
    const file = form.submissionFile?.files?.[0] || null;

    if (!assignmentId) {
      msg.innerHTML = '<span class="submission-error">Please select an assignment.</span>';
      return;
    }

    submitBtn.disabled = true;
    msg.innerHTML = '<span class="submission-info">📤 Submitting work...</span>';

    try {
      const assignmentRef = doc(db, 'assignments', assignmentId);
      const assignmentSnap = await getDoc(assignmentRef);

      if (!assignmentSnap.exists()) {
        throw new Error('Selected assignment was not found.');
      }

      const assignment = assignmentSnap.data();
      
      // Upload file to Cloudinary if provided
      let upload = { url: '', path: '', name: '' };
      if (file) {
        console.log('📤 Uploading file to Cloudinary...');
        upload = await uploadFile(file, `submissions/${user.uid}`);
        console.log('✅ File uploaded:', upload.url);
      }

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
        fileName: upload.name || file?.name || '',
        status: 'Submitted',
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const batch = writeBatch(db);

      // Save main submission
      batch.set(submissionRef, submissionPayload);

      // Save submission under assignment subcollection
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
          fileName: upload.name || file?.name || '',
          status: 'Submitted',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Update student record
      batch.set(
        doc(db, 'students', user.uid),
        {
          uid: user.uid,
          name: studentName,
          email: user.email || '',
          role: 'student',
          lastSubmissionAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      await batch.commit();

      msg.innerHTML = '<span class="submission-success">✅ Work submitted successfully!</span>';
      form.reset();
      
      // Clear file input
      if (form.submissionFile) form.submissionFile.value = '';
      
      // Refresh the page content
      setTimeout(async () => {
        const latestAssignments = await loadStudentAssignments(user.uid);
        const latestSubmissions = await loadStudentSubmissions(user.uid);
        
        const pageContent = document.getElementById('page-content');
        if (pageContent) {
          pageContent.innerHTML = renderSubmitWorkPage(
            profile,
            user,
            latestAssignments,
            latestSubmissions
          );
          await submitStudentWork({ user, profile });
        }
      }, 1500);
      
    } catch (error) {
      console.error('Submission error:', error);
      msg.innerHTML = `<span class="submission-error">❌ ${error.message || 'Submission failed.'}</span>`;
    } finally {
      submitBtn.disabled = false;
      setTimeout(() => {
        if (msg.innerHTML.includes('success')) {
          setTimeout(() => { msg.innerHTML = ''; }, 3000);
        }
      }, 2000);
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
   ACTIONS: RESOURCES (FIXED + BETTER UX)
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
  const saveBtn = document.getElementById('saveResourceBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('resourceTitle').value.trim();
    const type = document.getElementById('resourceType').value.trim();
    const classroomId = document.getElementById('resourceClassroomId').value;
    const studentId = document.getElementById('resourceStudentId').value;
    const note = document.getElementById('resourceNote').value.trim();
    const file = document.getElementById('resourceFile').files?.[0] || null;

    if (!title) {
      msg.textContent = 'Enter title';
      return;
    }

    saveBtn.disabled = true;
    msg.textContent = 'Uploading...';

    try {
      let upload = { url: '', path: '', name: '' };

      if (file) {
        upload = await uploadFile(file, `resources/${user.uid}`);
      }

      const classroom = classrooms.find(c => c.id === classroomId);
      const student = students.find(s => s.id === studentId);

      await setDoc(doc(collection(db, 'resources')), {
        tutorId: user.uid,
        title,
        type,
        note,

        classroomId,
        classroomName: classroom?.name || '',

        studentId,
        studentName: student?.full_name || student?.email || '',

        fileUrl: upload.url,
        filePath: upload.path,
        fileName: upload.name,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      msg.textContent = 'Saved!';
      form.reset();

      setTimeout(() => refreshResourcesPage(bundle), 300);

    } catch (err) {
      msg.textContent = err.message;
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.querySelectorAll('.resource-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;

      await deleteDoc(doc(db, 'resources', btn.dataset.id));
      refreshResourcesPage(bundle);
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
  console.log('🚀 Booting Submit Work Page');
  const bundle = await requireAuth();
  if (!bundle) return;
  
  if (bundle.profile?.role === 'student') {
    await ensureStudentMirror(bundle.user, bundle.profile);
  }
  
  const { user, profile } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;
  
  pageContent.innerHTML = '<div class="card panel"><div class="loading-block"><div class="loading-line"></div></div></div>';
  
  try {
    const params = new URLSearchParams(window.location.search);
    const forcedAssignmentId = params.get('assignmentId');
    
    const [assignments, submissions] = await Promise.all([
      loadStudentAssignments(user.uid),
      loadStudentSubmissions(user.uid)
    ]);
    
    console.log(`📝 Assignments: ${assignments.length}, Submissions: ${submissions.length}`);
    
    pageContent.innerHTML = renderSubmitWorkPage(profile, user, assignments, submissions);
    
    // Setup drag and drop for file upload
    setupDragAndDrop();
    
    if (forcedAssignmentId) {
      const select = document.getElementById('assignmentId');
      if (select) select.value = forcedAssignmentId;
    }
    
    await submitStudentWork({ user, profile });
  } catch (error) {
    console.error('Error loading submit work page:', error);
    pageContent.innerHTML = `
      <div class="card panel error">
        <h3>Error Loading Page</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" class="btn">Retry</button>
      </div>
    `;
  }
}

function setupDragAndDrop() {
  const dragArea = document.getElementById('dragArea');
  const fileInput = document.getElementById('submissionFile');
  const displayDiv = document.getElementById('selectedFileDisplay');
  
  if (!dragArea || !fileInput) return;
  
  dragArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  dragArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragArea.classList.add('drag-over');
  });
  
  dragArea.addEventListener('dragleave', () => {
    dragArea.classList.remove('drag-over');
  });
  
  dragArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      updateFileDisplay(files[0], displayDiv);
    }
  });
  
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      updateFileDisplay(fileInput.files[0], displayDiv);
    } else {
      displayDiv.innerHTML = '';
    }
  });
}

function updateFileDisplay(file, displayDiv) {
  if (!displayDiv) return;
  const size = (file.size / 1024).toFixed(1);
  displayDiv.innerHTML = `
    <span style="color: var(--primary);">✅ Selected: ${escapeHtml(file.name)} (${size} KB)</span>
  `;
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

async function bootStudentAssignmentsPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  await ensureStudentMirror(bundle.user, bundle.profile);
  await refreshStudentAssignmentsPage(bundle);
}

async function bootStudentAssessmentsPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  await ensureStudentMirror(bundle.user, bundle.profile);
  await refreshStudentAssessmentsPage(bundle);
}

async function bootStudentActivitiesPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  await ensureStudentMirror(bundle.user, bundle.profile);
  await refreshStudentActivitiesPage(bundle);
}

async function bootStudentMessagesPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  await ensureStudentMirror(bundle.user, bundle.profile);
  await refreshStudentMessagesPage(bundle);
}



/* =========================
   PORTFOLIO (STUDENT)
========================= */

async function loadStudentPortfolio(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'portfolio'), where('studentId', '==', studentUid))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}


function renderStudentPortfolioPage(items) {
  // Build the timeline cards
  const feedHtml = items.length
    ? items.map(item => `
        <div class="portfolio-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span class="tag">${escapeHtml(item.type || 'Reflection')}</span>
              ${item.feeling ? `<span class="tag feeling-badge">😊 ${escapeHtml(item.feeling)}</span>` : ''}
            </div>
            <small>${fmtDate(item.createdAt)}</small>
          </div>
          <h4 style="margin: 12px 0 8px;">${escapeHtml(item.title || 'Untitled')}</h4>
          <p>${escapeHtml(item.note || '')}</p>
          ${item.fileUrl ? `
            <div class="file-preview">
              ${renderFilePreview(item.fileUrl, item.fileName)}
            </div>
          ` : ''}
        </div>
      `).join('')
    : `<div class="empty-feed">✨ No entries yet – start your journey by adding one!</div>`;

  return `
    <div class="portfolio-grid">
      <!-- LEFT: Add new entry -->
      <div class="card panel portfolio-form">
        <h3>📖 New Journal Entry</h3>
        <form id="portfolioForm" class="stack-form">
          <div class="form-row">
            <label>Type / Tag</label>
            <select id="portfolioType" required>
              <option value="Achievement">🏆 Achievement</option>
              <option value="Challenge">⚠️ Challenge</option>
              <option value="Progress">📈 Progress</option>
              <option value="Reflection">🤔 Reflection</option>
              <option value="Personal">💡 Personal</option>
            </select>
          </div>
          <div class="form-row">
            <label>How are you feeling?</label>
            <select id="portfolioFeeling">
              <option value="">— Optional —</option>
              <option value="Excited">Excited</option>
              <option value="Struggling">Struggling</option>
              <option value="Proud">Proud</option>
              <option value="Curious">Curious</option>
              <option value="Neutral">Neutral</option>
            </select>
          </div>
          <div class="form-row">
            <label>Title (short summary)</label>
            <input id="portfolioTitle" placeholder="What happened today?">
          </div>
          <div class="form-row">
            <label>Your reflection / notes</label>
            <textarea id="portfolioNote" placeholder="Write your thoughts, challenges, or achievements..."></textarea>
          </div>
          <div class="form-row">
            <label>Upload (image, video, PDF)</label>
            <input id="portfolioFile" type="file" accept="image/*,video/*,application/pdf">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn">✨ Add to Journey</button>
            <span id="portfolioMsg"></span>
          </div>
        </form>
      </div>

      <!-- RIGHT: Timeline feed -->
      <div>
        <h3>🌟 My Learning Journey</h3>
        <div class="portfolio-feed">${feedHtml}</div>
      </div>
    </div>
  `;
}

// attach the submission handler only once, using a flag
let portfolioFormListenerAttached = false;


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
async function bootStudentPortfolioPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  await ensureStudentMirror(bundle.user, bundle.profile);
  await refreshStudentPortfolioPage(bundle);
}

async function bootStudentPortfolio() {
  const bundle = await requireAuth();
  if (!bundle) return;

  await ensureStudentMirror(bundle.user, bundle.profile);

  const items = await loadStudentPortfolio(bundle.user.uid);

  document.getElementById('page-content').innerHTML =
    renderStudentPortfolio(items);

  await submitStudentPortfolio(bundle);
}

/* =========================
   TUTOR PORTFOLIO (FULL LIFE VIEW)
========================= */

async function bootTutorPortfolios() {
  const bundle = await requireAuth();
  if (!bundle) return;

  const items = await loadAllPortfolios();

  document.getElementById('page-content').innerHTML =
    renderTutorPortfolios(items);
}

async function loadParentChildren(parentUid) {

  // 🔥 You MUST store parentId on student when linking
  const snap = await getDocs(
    query(collection(db, 'users'), where('parentId', '==', parentUid))
  );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}
function renderParentChildrenPage(children) {

  const cards = children.map(child => `
    <div class="card panel" style="margin-bottom:16px">

      <h3>${escapeHtml(child.full_name || child.name || 'Student')}</h3>
      <p>Grade: ${escapeHtml(child.grade_level || '—')}</p>

      <button 
        class="btn view-portfolio-btn"
        data-id="${child.id}"
      >
        View Portfolio
      </button>

    </div>
  `).join('');

  return `
    <section class="card panel">
      <h3>Your Children</h3>
      ${children.length ? cards : '<div class="empty">No children linked</div>'}
    </section>
  `;
}

async function bootParentChildrenPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  const { user } = bundle;

  const children = await loadParentChildren(user.uid);

  const container = document.getElementById('page-content');
  container.innerHTML = renderParentChildrenPage(children);

  // 🔥 CLICK HANDLER (NAVIGATE)
  document.querySelectorAll('.view-portfolio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const childId = btn.dataset.id;

      // 🔥 PASS CHILD ID VIA URL
      window.location.href = `/parent/portfolio.html?childId=${childId}`;
    });
  });
}
async function loadChildPortfolio(childId) {

  const snap = await getDocs(
    query(collection(db, 'portfolio'), where('studentId', '==', childId))
  );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}
async function bootStudentReportsPage() {
  console.log('🚀 Booting Student Reports Page');
  const bundle = await requireAuth();
  if (!bundle) return;
  
  const { user, profile } = bundle;
  
  await ensureStudentMirror(user, profile);
  
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;
  
  pageContent.innerHTML = '<div class="card panel"><div class="loading-block"><div class="loading-line"></div></div></div>';
  
  try {
    const reports = await loadStudentReports(user.uid);
    console.log('📄 Reports loaded:', reports.length);
    pageContent.innerHTML = renderStudentReportsPage(reports);
  } catch (error) {
    console.error('Error loading reports:', error);
    pageContent.innerHTML = `
      <div class="card panel error">
        <h3>Error Loading Reports</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" class="btn">Retry</button>
      </div>
    `;
  }
}



async function loadAllPortfolios() {
  const snap = await getDocs(collection(db, 'portfolio'));

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}
function renderTutorPortfolios(items) {

  const grouped = {};

  items.forEach(item => {
    if (!grouped[item.studentId]) {
      grouped[item.studentId] = {
        name: item.studentName || 'Student',
        entries: []
      };
    }
    grouped[item.studentId].entries.push(item);
  });

  const html = Object.values(grouped).map(student => `
    <section class="card panel" style="margin-bottom:20px">

      <h3>${escapeHtml(student.name)}</h3>

      ${student.entries.map(entry => `
        <div style="margin-top:12px;padding:12px;border-radius:12px;background:var(--surface-2)">
          
          <strong>${escapeHtml(entry.type || '')}</strong>
          <small style="float:right">${fmtDate(entry.createdAt)}</small>

          <p>${escapeHtml(entry.note || '')}</p>

          ${entry.fileUrl ? renderFilePreview(entry.fileUrl, entry.fileName) : ''}

        </div>
      `).join('')}

    </section>
  `).join('');

  return html || '<div class="empty">No portfolios yet</div>';
}

/* =========================
   REPORT SYSTEM
========================= */

async function bootReportsPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  if (bundle.profile?.role === 'student') {
    await ensureStudentMirror(bundle.user, bundle.profile);
    await refreshStudentReportsPage(bundle);
    return;
  }

  const { user } = bundle;
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

    await setDoc(doc(collection(db, 'reports')), {
      studentId: reportStudent.value,
      strengths: reportStrengths.value,
      lows: reportLows.value,
      summary: reportSummary.value,
      createdAt: serverTimestamp()
    });

    alert('Report saved');
  });
}

/* =========================
   DASHBOARD (REAL ANALYTICS)
========================= */

async function bootDashboard() {
  const bundle = await requireAuth();
  if (!bundle) return;

  if (bundle.profile?.role === 'student') {
    await ensureStudentMirror(bundle.user, bundle.profile);
    await refreshStudentDashboard(bundle);
    return;
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



async function bootStudentResourcesPage() {
  console.log('🚀 Booting Student Resources Page');
  const bundle = await requireAuth();
  if (!bundle) return;
  
  const { user, profile } = bundle;
  
  // Ensure student mirror exists
  await ensureStudentMirror(user, profile);
  
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;
  
  // Show loading state
  pageContent.innerHTML = '<div class="card panel"><div class="loading-block"><div class="loading-line"></div></div></div>';
  
  try {
    const resources = await loadStudentResources(user.uid);
    console.log('📚 Resources loaded:', resources.length);
    pageContent.innerHTML = renderStudentResourcesPage(resources);
  } catch (error) {
    console.error('Error loading resources:', error);
    pageContent.innerHTML = `
      <div class="card panel error">
        <h3>Error Loading Resources</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" class="btn">Retry</button>
      </div>
    `;
  }
}


async function bootParentPortfolioPage() {
  const bundle = await requireAuth();
  if (!bundle) return;

  const params = new URLSearchParams(window.location.search);
  const childId = params.get('childId');

  if (!childId) {
    document.getElementById('page-content').innerHTML =
      '<div class="empty">No child selected</div>';
    return;
  }

  const items = await loadChildPortfolio(childId);

  document.getElementById('page-content').innerHTML =
    renderParentPortfolio(items);
}
/* ========================= CLEAN UNIFIED PAGE ROUTER ========================= */

// Remove the conflicting onAuthStateChanged that calls loadExtendedPages
// (Delete the entire block that starts with onAuthStateChanged at the bottom)

if (pageKey === 'submit-work') {
  bootSubmitWorkPage();
} 
else if (pageKey === 'lesson-plans' && pageRole === 'tutor') {
  bootLessonPlansPageComplete();    // Full version with objectives, materials
}
else if (pageKey === 'learners' && pageRole === 'tutor') {
  bootLearnersPageComplete();       // Reports, comments, student history
}
else if (pageKey === 'classrooms' && pageRole === 'tutor') {
  bootClassroomsPageComplete();     // Teaching mode, broadcasts, student assignment
}
else if (pageKey === 'assignments' && pageRole === 'tutor') {
  bootAssignmentsPageComplete();    // Assign to specific students, grade work
}
else if (pageKey === 'resources') {
  if (pageRole === 'tutor') bootResourcesPage();
  else if (pageRole === 'student') bootStudentResourcesPage();
}
else if (pageKey === 'messages' && pageRole === 'tutor') {
  bootMessagesPageComplete();       // Conversation threads with replies
}
else if (pageKey === 'reports' && pageRole === 'tutor') {
  bootReportsPageComplete();        // Full CRUD: strengths, lows, next steps
}
// Student Pages
else if (pageKey === 'assignments' && pageRole === 'student') {
  bootStudentAssignmentsPage();
}
else if (pageKey === 'assessments' && pageRole === 'student') {
  bootStudentAssessmentsPage();
}
else if (pageKey === 'portfolio' && pageRole === 'student') {
  bootStudentPortfolioPage();
}
else if (pageKey === 'reports' && pageRole === 'student') {
  bootStudentReportsPage();
}
// Parent pages
else if (pageKey === 'children' && pageRole === 'parent') {
  bootParentChildrenPage();
}
else if (pageKey === 'portfolio' && pageRole === 'parent') {
  bootParentPortfolioPage();
}
else if (pageKey === 'portfolios' && pageRole === 'tutor') {
  bootTutorPortfolios();
}
else if (pageKey === 'dashboard') {
  bootDashboard();   // This already handles both tutor & student dashboards
}
else {
  bootDefaultPage();
}

/* =========================
   EXTENDED MODERN PAGES (optional overrides)
========================= */

/* =====================================================
   EXTENSION: NEW PAGE SYSTEM (DO NOT REMOVE OLD CODE)
   Unified handler for new / modernized pages
   ===================================================== */

async function loadExtendedPages(user, profile) {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  switch (pageKey) {
    /* ================= DASHBOARD ================= */
    case 'dashboard': {
      const students = await loadAllStudents();
      const assignmentsSnap = await getDocs(
        query(collection(db, 'assignments'), where('tutorId', '==', user.uid))
      );
      const submissionsSnap = await getDocs(
        query(collection(db, 'submissions'), where('tutorId', '==', user.uid))
      );

      pageContent.innerHTML = `
        <div class="grid cols-3 gap-4" style="margin-bottom:24px;">
          <div class="card stat success">
            <h3>${students.length}</h3>
            <p>Total Students</p>
          </div>
          <div class="card stat primary">
            <h3>${assignmentsSnap.size}</h3>
            <p>Assignments Created</p>
          </div>
          <div class="card stat warn">
            <h3>${submissionsSnap.size}</h3>
            <p>Total Submissions</p>
          </div>
        </div>

        <div class="card panel">
          <h3>Recent Activity (last 10 submissions)</h3>
          <div id="recentActivity" class="stack gap-3"></div>
        </div>
      `;

      const container = document.getElementById('recentActivity');
      if (container && submissionsSnap.docs.length > 0) {
        submissionsSnap.docs.slice(0, 10).forEach(docSnap => {
          const d = docSnap.data();
          container.innerHTML += `
            <div class="list-item flex between">
              <div>
                <strong>${escapeHtml(d.assignmentTitle || 'Submission')}</strong>
                <div><small>by ${escapeHtml(d.studentName || 'Student')}</small></div>
              </div>
              <div class="text-right">
                <small>${fmtDate(d.submittedAt)}</small>
                <div>${statusBadge(d.status)}</div>
              </div>
            </div>
          `;
        });
      } else if (container) {
        container.innerHTML = '<p class="empty">No recent submissions yet.</p>';
      }
      break;
    }

    /* ================= ASSIGNMENTS (tutor only for now) ================= */
    case 'assignments': {
      if (pageRole !== 'tutor') {
        pageContent.innerHTML = '<div class="card panel"><p>This page is only available for tutors.</p></div>';
        break;
      }

      const snap = await getDocs(
        query(collection(db, 'assignments'), where('tutorId', '==', user.uid))
      );

      pageContent.innerHTML = `
        <section class="card panel">
          <h3>Create New Assignment</h3>
          <form id="assignmentForm" class="stack-form">
            <div class="form-row">
              <label>Title</label>
              <input name="title" required placeholder="Mid-term Math Test">
            </div>
            <div class="form-row">
              <label>Subject</label>
              <input name="subject" placeholder="Mathematics">
            </div>
            <div class="form-row">
              <label>Description / Instructions</label>
              <textarea name="description" rows="4" placeholder="Complete all questions..."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn primary">Create Assignment</button>
              <span id="assignMsg"></span>
            </div>
          </form>
        </section>

        <section class="card panel" style="margin-top:24px;">
          <h3>Your Assignments (${snap.size})</h3>
          <div id="assignmentList" class="stack gap-3"></div>
        </section>
      `;

      const list = document.getElementById('assignmentList');
      if (snap.empty) {
        list.innerHTML = '<p class="empty">No assignments created yet.</p>';
      } else {
        snap.forEach(docSnap => {
          const d = docSnap.data();
          list.innerHTML += `
            <div class="list-item flex between">
              <div>
                <strong>${escapeHtml(d.title || 'Untitled')}</strong>
                <div><small>${escapeHtml(d.subject || '—')}</small></div>
              </div>
              <div>
                <button class="btn danger small" data-id="${docSnap.id}">Delete</button>
              </div>
            </div>
          `;
        });
      }

      document.getElementById('assignmentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const msg = document.getElementById('assignMsg');

        try {
          await setDoc(doc(collection(db, 'assignments')), {
            tutorId: user.uid,
            tutorName: profile?.name || profile?.full_name || user.email || 'Tutor',
            title: f.title.value.trim(),
            subject: f.subject.value.trim(),
            description: f.description.value.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          msg.textContent = 'Assignment created!';
          msg.className = 'success';
          setTimeout(() => location.reload(), 1200);
        } catch (err) {
          msg.textContent = 'Error: ' + err.message;
          msg.className = 'danger';
        }
      });

      list?.addEventListener('click', async (e) => {
        if (e.target.dataset.id && confirm('Delete this assignment?')) {
          await deleteDoc(doc(db, 'assignments', e.target.dataset.id));
          location.reload();
        }
      });
      break;
    }

    // ────────────────────────────────────────────────
    //  Placeholder / skeleton for other new pages
    //  You can expand these later
    // ────────────────────────────────────────────────

    case 'assessments':
      pageContent.innerHTML = `<div class="card panel"><h3>Assessments (coming soon)</h3><p>Grade submissions here...</p></div>`;
      break;

    case 'attendance':
      pageContent.innerHTML = `<div class="card panel"><h3>Attendance (coming soon)</h3><p>Record daily presence...</p></div>`;
      break;

    case 'portfolios':
      pageContent.innerHTML = `<div class="card panel"><h3>Student Portfolios Overview (coming soon)</h3></div>`;
      break;

    case 'reports':
      pageContent.innerHTML = `<div class="card panel"><h3>Report Cards (coming soon)</h3></div>`;
      break;

    case 'settings':
      pageContent.innerHTML = `
        <div class="card panel">
          <h3>Profile Settings</h3>
          <form id="settingsForm" class="stack-form">
            <div class="form-row">
              <label>Full Name</label>
              <input name="full_name" value="${escapeHtml(profile?.full_name || profile?.name || '')}">
            </div>
            <button type="submit" class="btn primary">Update Profile</button>
          </form>
        </div>
      `;
      document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.full_name.value.trim();
        if (name) {
          await updateDoc(doc(db, 'users', user.uid), {
            full_name: name,
            updatedAt: serverTimestamp()
          });
          alert('Profile updated');
          location.reload();
        }
      });
      break;

    default:
      // Do nothing — let old boot functions handle it
      break;
  }
}



// Add these functions to your existing pages.js file

// ==================== COMPLETE LEARNERS PAGE WITH REPORTS ====================
async function refreshLearnersPageComplete(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  // Load all students from Firebase
  const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Load all reports
  const reportsSnap = await getDocs(collection(db, 'reports'));
  const reports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Load all comments
  const commentsSnap = await getDocs(collection(db, 'student-comments'));
  const comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const studentsHtml = students.map(student => {
    const studentReports = reports.filter(r => r.studentId === student.id);
    const studentComments = comments.filter(c => c.studentId === student.id);
    
    return `
      <div class="student-card">
        <div class="student-header">
          <div>
            <div class="student-name">${escapeHtml(student.full_name || student.name || 'Student')}</div>
            <div class="student-email">${escapeHtml(student.email || 'No email')}</div>
          </div>
          <div>
            <button class="btn small" onclick="openReportModal('${student.id}', '${escapeHtml(student.full_name || student.name)}')">📝 Write Report</button>
            <button class="btn small" onclick="openCommentModal('${student.id}', '${escapeHtml(student.full_name || student.name)}')">💬 Add Comment</button>
            <button class="btn small" onclick="viewStudentDetails('${student.id}')">👁️ View</button>
          </div>
        </div>
        
        <div class="student-stats">
          <span class="stat-badge">📊 ${studentReports.length} Reports</span>
          <span class="stat-badge">💬 ${studentComments.length} Comments</span>
          <span class="stat-badge">🏫 ${student.classroomName || 'No classroom'}</span>
        </div>
        
        ${studentReports.length > 0 ? `
          <div style="margin-top: 12px;">
            <strong>Latest Reports:</strong>
            ${studentReports.slice(0, 2).map(report => `
              <div class="report-card">
                <strong>${escapeHtml(report.title || 'Progress Report')}</strong>
                <p>${escapeHtml(report.summary || report.strengths || '')}</p>
                <small>${fmtDate(report.createdAt)}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${studentComments.length > 0 ? `
          <div style="margin-top: 12px;">
            <strong>Recent Comments:</strong>
            ${studentComments.slice(0, 2).map(comment => `
              <div class="comment-item">
                <div>${escapeHtml(comment.comment)}</div>
                <div class="comment-date">${fmtDate(comment.createdAt)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  pageContent.innerHTML = `
    <div class="grid-2">
      <div>
        <h3>All Students (${students.length})</h3>
        ${studentsHtml || '<div class="empty">No students registered yet.</div>'}
      </div>
      
      <div>
        <div class="card panel">
          <h3>Quick Actions</h3>
          <button class="btn" onclick="showAllReports()">📊 View All Reports</button>
          <button class="btn" onclick="showAllComments()">💬 View All Comments</button>
          <button class="btn" onclick="exportData()">📥 Export Data</button>
        </div>
        
        <div class="card panel" style="margin-top: 16px;">
          <h3>Student Insights</h3>
          <div id="insights"></div>
        </div>
      </div>
    </div>
  `;
  
  // Store data globally for modals
  window.studentsData = students;
  window.reportsData = reports;
  window.commentsData = comments;
}

// ==================== COMPLETE CLASSROOMS WITH TEACHING MODE ====================
async function refreshClassroomsPageComplete(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const classroomsSnap = await getDocs(query(collection(db, 'classrooms'), where('tutorId', '==', user.uid)));
  const classrooms = classroomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
  const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const classroomsHtml = classrooms.map(classroom => {
    const classStudents = allStudents.filter(s => classroom.studentIds?.includes(s.id));
    
    return `
      <div class="classroom-card">
        <div class="classroom-header">
          <div>
            <div class="classroom-title">${escapeHtml(classroom.name)}</div>
            <div>${escapeHtml(classroom.subject)}</div>
          </div>
          <div>
            <button class="btn small" onclick="startTeachingMode('${classroom.id}', '${escapeHtml(classroom.name)}')">🎓 Start Teaching Mode</button>
            <button class="btn small danger" onclick="deleteClassroom('${classroom.id}')">Delete</button>
          </div>
        </div>
        
        <div>${escapeHtml(classroom.description || 'No description')}</div>
        
        <div class="student-list">
          ${classStudents.map(s => `<span class="student-tag">${escapeHtml(s.full_name || s.name)}</span>`).join('')}
        </div>
        
        <div id="teaching-mode-${classroom.id}" style="display: none;" class="teaching-mode">
          <div style="background: #2ecc71; padding: 16px; border-radius: 8px;">
            <h4>🎓 Teaching Mode Active</h4>
            <p>Share screen, start lesson, or broadcast message to class</p>
            <button class="btn" onclick="broadcastToClass('${classroom.id}')">📢 Broadcast Message</button>
            <button class="btn" onclick="startLiveLesson('${classroom.id}')">🎥 Start Live Lesson</button>
            <button class="btn" onclick="endTeachingMode('${classroom.id}')">End Mode</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  pageContent.innerHTML = `
    <section class="card panel">
      <h3>Create New Classroom</h3>
      <form id="classroomForm" class="stack-form">
        <div class="form-row">
          <label>Classroom Name</label>
          <input id="className" required placeholder="e.g., Grade 8 Mathematics">
        </div>
        <div class="form-row">
          <label>Subject</label>
          <input id="classSubject" required placeholder="e.g., Mathematics">
        </div>
        <div class="form-row">
          <label>Description</label>
          <textarea id="classDesc" rows="3"></textarea>
        </div>
        <div class="form-row">
          <label>Select Students</label>
          <select id="classStudents" multiple size="5">
            ${allStudents.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="btn">Create Classroom</button>
      </form>
    </section>
    
    <h3 style="margin-top: 24px;">My Classrooms (${classrooms.length})</h3>
    ${classroomsHtml || '<div class="empty">No classrooms yet. Create one above!</div>'}
  `;
  
  // Handle form submission
  document.getElementById('classroomForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('className').value;
    const subject = document.getElementById('classSubject').value;
    const description = document.getElementById('classDesc').value;
    const studentSelect = document.getElementById('classStudents');
    const studentIds = Array.from(studentSelect.selectedOptions).map(opt => opt.value);
    
    await setDoc(doc(collection(db, 'classrooms')), {
      tutorId: user.uid,
      name, subject, description,
      studentIds,
      createdAt: serverTimestamp()
    });
    
    alert('Classroom created!');
    location.reload();
  });
}

// ==================== COMPLETE ASSIGNMENTS WITH STUDENT SELECTION ====================
async function refreshAssignmentsPageComplete(bundle) {
  const { user, profile } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const assignmentsSnap = await getDocs(query(collection(db, 'assignments'), where('tutorId', '==', user.uid)));
  const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const submissionsSnap = await getDocs(collection(db, 'submissions'));
  const submissions = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const assignmentsHtml = assignments.map(assignment => {
    const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
    const assignedStudent = students.find(s => s.id === assignment.studentId);
    
    return `
      <div class="assignment-card">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <h4>${escapeHtml(assignment.title)}</h4>
            <div>${escapeHtml(assignment.subject || 'No subject')}</div>
            ${assignment.dueDate ? `<div>Due: ${fmtDate(assignment.dueDate)}</div>` : ''}
            ${assignedStudent ? `<div>Assigned to: <strong>${escapeHtml(assignedStudent.full_name || assignedStudent.name)}</strong></div>` : '<div>Assigned to: All students</div>'}
          </div>
          <div>
            <button class="btn small danger" onclick="deleteAssignment('${assignment.id}')">Delete</button>
          </div>
        </div>
        <div>${escapeHtml(assignment.description || 'No description')}</div>
        
        <div style="margin-top: 12px;">
          <strong>Submissions (${assignmentSubmissions.length}):</strong>
          ${assignmentSubmissions.map(sub => `
            <div class="submission-item">
              <div>${escapeHtml(sub.studentName)} - ${sub.status || 'Submitted'}</div>
              ${sub.fileUrl ? `<a href="${sub.fileUrl}" target="_blank">View File</a>` : ''}
              <div>
                <input type="number" id="grade-${sub.id}" placeholder="Grade" class="grade-input">
                <button class="btn small" onclick="gradeSubmission('${sub.id}', '${assignment.id}')">Submit Grade</button>
              </div>
            </div>
          `).join('') || '<div>No submissions yet</div>'}
        </div>
      </div>
    `;
  }).join('');

  pageContent.innerHTML = `
    <section class="card panel">
      <h3>Create New Assignment</h3>
      <form id="assignmentForm" class="stack-form">
        <div class="form-row">
          <label>Assignment Title *</label>
          <input id="assignTitle" required>
        </div>
        <div class="form-row">
          <label>Subject</label>
          <input id="assignSubject">
        </div>
        <div class="form-row">
          <label>Description / Instructions</label>
          <textarea id="assignDesc" rows="4"></textarea>
        </div>
        <div class="form-row">
          <label>Assign to Student (Optional - leave blank for all)</label>
          <select id="assignStudent">
            <option value="">-- All Students --</option>
            ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Due Date</label>
          <input id="assignDue" type="date">
        </div>
        <button type="submit" class="btn">Create Assignment</button>
      </form>
    </section>
    
    <h3 style="margin-top: 24px;">My Assignments (${assignments.length})</h3>
    ${assignmentsHtml || '<div class="empty">No assignments yet. Create one above!</div>'}
  `;
  
  document.getElementById('assignmentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('assignTitle').value;
    const subject = document.getElementById('assignSubject').value;
    const description = document.getElementById('assignDesc').value;
    const studentId = document.getElementById('assignStudent').value || null;
    const dueDate = document.getElementById('assignDue').value;
    
    await setDoc(doc(collection(db, 'assignments')), {
      tutorId: user.uid,
      tutorName: profile?.full_name || profile?.name,
      title, subject, description,
      studentId,
      dueDate,
      createdAt: serverTimestamp(),
      status: 'Active'
    });
    
    alert('Assignment created!');
    location.reload();
  });
}

// ==================== COMPLETE REPORTS PAGE ====================
async function refreshReportsPageComplete(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const reportsSnap = await getDocs(collection(db, 'reports'));
  const reports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const reportsHtml = reports.map(report => {
    const student = students.find(s => s.id === report.studentId);
    return `
      <div class="report-card">
        <div style="display: flex; justify-content: space-between;">
          <h4>${escapeHtml(report.title || 'Progress Report')}</h4>
          <small>${fmtDate(report.createdAt)}</small>
        </div>
        <div><strong>Student:</strong> ${escapeHtml(student?.full_name || student?.name || 'Unknown')}</div>
        <div><strong>Strengths:</strong> ${escapeHtml(report.strengths || '—')}</div>
        <div><strong>Areas to Improve:</strong> ${escapeHtml(report.lows || '—')}</div>
        <div><strong>Summary:</strong> ${escapeHtml(report.summary || '—')}</div>
        <div><strong>Next Steps:</strong> ${escapeHtml(report.nextSteps || '—')}</div>
        <button class="btn small" onclick="editReport('${report.id}')">Edit</button>
        <button class="btn small danger" onclick="deleteReport('${report.id}')">Delete</button>
      </div>
    `;
  }).join('');

  pageContent.innerHTML = `
    <div class="report-form">
      <h3>📝 Create Progress Report</h3>
      <form id="reportForm">
        <div class="form-group">
          <label>Select Student *</label>
          <select id="reportStudentId" required>
            <option value="">-- Choose Student --</option>
            ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label>Report Title</label>
          <input id="reportTitle" placeholder="e.g., Term 1 Progress Report">
        </div>
        
        <div class="form-group">
          <label>Strengths / Highs</label>
          <textarea id="reportStrengths" rows="3" placeholder="What is the student doing well?"></textarea>
        </div>
        
        <div class="form-group">
          <label>Areas to Improve / Lows</label>
          <textarea id="reportLows" rows="3" placeholder="What needs improvement?"></textarea>
        </div>
        
        <div class="form-group">
          <label>Summary / Overall Progress</label>
          <textarea id="reportSummary" rows="4" placeholder="Overall summary of student progress..."></textarea>
        </div>
        
        <div class="form-group">
          <label>Next Steps / Recommendations</label>
          <textarea id="reportNextSteps" rows="3" placeholder="What should the student focus on next?"></textarea>
        </div>
        
        <button type="submit" class="btn">💾 Save Report</button>
      </form>
    </div>
    
    <h3>📋 Previous Reports (${reports.length})</h3>
    ${reportsHtml || '<div class="empty">No reports yet. Create your first report above!</div>'}
  `;
  
  document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('reportStudentId').value;
    const title = document.getElementById('reportTitle').value;
    const strengths = document.getElementById('reportStrengths').value;
    const lows = document.getElementById('reportLows').value;
    const summary = document.getElementById('reportSummary').value;
    const nextSteps = document.getElementById('reportNextSteps').value;
    
    if (!studentId) {
      alert('Please select a student');
      return;
    }
    
    await setDoc(doc(collection(db, 'reports')), {
      studentId,
      title: title || 'Progress Report',
      strengths,
      lows,
      summary,
      nextSteps,
      tutorId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    alert('Report saved successfully!');
    location.reload();
  });
}

// ==================== COMPLETE MESSAGES PAGE ====================
async function refreshMessagesPageComplete(bundle) {
  const { user } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const messagesSnap = await getDocs(query(collection(db, 'messages'), where('tutorId', '==', user.uid)));
  const messages = messagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Group messages by student
  const messagesByStudent = {};
  messages.forEach(msg => {
    if (!messagesByStudent[msg.studentId]) messagesByStudent[msg.studentId] = [];
    messagesByStudent[msg.studentId].push(msg);
  });

  const threadsHtml = Object.entries(messagesByStudent).map(([studentId, studentMessages]) => {
    const student = students.find(s => s.id === studentId);
    return `
      <div class="message-thread">
        <div class="message-header" onclick="toggleThread('${studentId}')">
          💬 ${escapeHtml(student?.full_name || student?.name || 'Student')} (${studentMessages.length} messages)
        </div>
        <div id="thread-${studentId}" style="display: block;">
          ${studentMessages.map(msg => `
            <div class="message-body">
              <div class="message-bubble ${msg.sender === 'tutor' ? 'tutor' : ''}">
                <strong>${msg.sender === 'tutor' ? 'You' : escapeHtml(student?.full_name || student?.name)}:</strong>
                ${escapeHtml(msg.message)}
                <div style="font-size: 11px; margin-top: 4px;">${fmtDate(msg.createdAt)}</div>
              </div>
            </div>
          `).join('')}
          <div class="reply-area">
            <textarea id="reply-${studentId}" rows="2" placeholder="Type your reply..."></textarea>
            <button class="btn small" onclick="sendMessage('${studentId}', '${escapeHtml(student?.full_name || student?.name)}')">Send Reply</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  pageContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 300px 1fr; gap: 20px;">
      <div class="card panel">
        <h3>New Message</h3>
        <form id="newMessageForm">
          <div class="form-group">
            <label>To:</label>
            <select id="messageStudentId" required>
              <option value="">-- Select Student --</option>
              ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Subject (optional)</label>
            <input id="messageSubject">
          </div>
          <div class="form-group">
            <label>Message</label>
            <textarea id="messageBody" rows="4" required></textarea>
          </div>
          <button type="submit" class="btn">Send Message</button>
        </form>
      </div>
      
      <div>
        <h3>Conversations (${Object.keys(messagesByStudent).length})</h3>
        ${threadsHtml || '<div class="empty">No conversations yet. Send your first message!</div>'}
      </div>
    </div>
  `;
  
  document.getElementById('newMessageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('messageStudentId').value;
    const subject = document.getElementById('messageSubject').value;
    const message = document.getElementById('messageBody').value;
    
    if (!studentId || !message) {
      alert('Please select a student and enter a message');
      return;
    }
    
    const student = students.find(s => s.id === studentId);
    
    await setDoc(doc(collection(db, 'messages')), {
      tutorId: user.uid,
      studentId,
      studentName: student?.full_name || student?.name,
      subject,
      message,
      sender: 'tutor',
      createdAt: serverTimestamp()
    });
    
    alert('Message sent!');
    location.reload();
  });
}

// ==================== COMPLETE LESSON PLANS PAGE ====================
async function refreshLessonPlansPageComplete(bundle) {
  const { user, profile } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const plansSnap = await getDocs(query(collection(db, 'lesson-plans'), where('tutorId', '==', user.uid)));
  const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const plansHtml = plans.map(plan => `
    <div class="lesson-card">
      <div style="display: flex; justify-content: space-between;">
        <h3>📖 ${escapeHtml(plan.title)}</h3>
        <div>
          <button class="btn small" onclick="editLessonPlan('${plan.id}')">Edit</button>
          <button class="btn small danger" onclick="deleteLessonPlan('${plan.id}')">Delete</button>
        </div>
      </div>
      
      <div class="lesson-meta">
        <span class="badge-subject">${escapeHtml(plan.subject)}</span>
        <span>🏫 ${escapeHtml(plan.classroomName || 'General')}</span>
        <span>📅 ${fmtDate(plan.plannedDate)}</span>
        <span>${statusBadge(plan.status || 'Draft')}</span>
      </div>
      
      <div class="objectives-list">
        <strong>🎯 Objectives:</strong>
        <p>${escapeHtml(plan.objectives || 'No objectives set')}</p>
      </div>
      
      <div>
        <strong>📚 Materials:</strong>
        <p>${escapeHtml(plan.materials || 'No materials listed')}</p>
      </div>
      
      <div>
        <strong>📝 Notes / Activities:</strong>
        <p>${escapeHtml(plan.notes || 'No notes')}</p>
      </div>
      
      ${plan.attachmentUrl ? `<a href="${plan.attachmentUrl}" target="_blank" class="btn small">📎 Download Attachment</a>` : ''}
      
      <div style="margin-top: 12px;">
        <button class="btn small" onclick="publishLessonPlan('${plan.id}')">${plan.status === 'Published' ? 'Unpublish' : 'Publish'}</button>
      </div>
    </div>
  `).join('');

  pageContent.innerHTML = `
    <section class="card panel">
      <h3>📝 Create New Lesson Plan</h3>
      <form id="lessonPlanForm" class="stack-form">
        <div class="form-row">
          <label>Lesson Title *</label>
          <input id="planTitle" required>
        </div>
        <div class="form-row">
          <label>Subject *</label>
          <input id="planSubject" required>
        </div>
        <div class="form-row">
          <label>Classroom / Grade Level</label>
          <input id="planClassroom">
        </div>
        <div class="form-row">
          <label>Date *</label>
          <input id="planDate" type="date" required>
        </div>
        <div class="form-row">
          <label>Learning Objectives</label>
          <textarea id="planObjectives" rows="3" placeholder="What will students learn?"></textarea>
        </div>
        <div class="form-row">
          <label>Materials Needed</label>
          <textarea id="planMaterials" rows="3" placeholder="Books, links, worksheets..."></textarea>
        </div>
        <div class="form-row">
          <label>Lesson Activities / Notes</label>
          <textarea id="planNotes" rows="5" placeholder="Step by step lesson plan..."></textarea>
        </div>
        <div class="form-row">
          <label>Attachment (optional)</label>
          <input id="planAttachment" type="file">
        </div>
        <button type="submit" class="btn">Save Lesson Plan</button>
      </form>
    </section>
    
    <h3 style="margin-top: 24px;">📚 My Lesson Plans (${plans.length})</h3>
    ${plansHtml || '<div class="empty">No lesson plans yet. Create your first plan above!</div>'}
  `;
  
  document.getElementById('lessonPlanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('planTitle').value;
    const subject = document.getElementById('planSubject').value;
    const classroomName = document.getElementById('planClassroom').value;
    const plannedDate = document.getElementById('planDate').value;
    const objectives = document.getElementById('planObjectives').value;
    const materials = document.getElementById('planMaterials').value;
    const notes = document.getElementById('planNotes').value;
    const file = document.getElementById('planAttachment').files[0];
    
    let attachmentUrl = '';
    if (file) {
      const upload = await uploadFile(file, `lesson-plans/${user.uid}`);
      attachmentUrl = upload.url;
    }
    
    await setDoc(doc(collection(db, 'lesson-plans')), {
      tutorId: user.uid,
      tutorName: profile?.full_name || profile?.name,
      title, subject, classroomName, plannedDate,
      objectives, materials, notes,
      attachmentUrl,
      status: 'Draft',
      createdAt: serverTimestamp()
    });
    
    alert('Lesson plan saved!');
    location.reload();
  });
}

// ==================== UTILITY FUNCTIONS FOR MODALS ====================

window.openReportModal = (studentId, studentName) => {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Write Report for ${studentName}</h3>
      <form id="quickReportForm">
        <div class="form-group">
          <label>Title</label>
          <input id="quickReportTitle" placeholder="Progress Report">
        </div>
        <div class="form-group">
          <label>Strengths</label>
          <textarea id="quickStrengths" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>Areas to Improve</label>
          <textarea id="quickLows" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>Summary</label>
          <textarea id="quickSummary" rows="3"></textarea>
        </div>
        <button type="submit" class="btn">Save Report</button>
        <button type="button" class="btn" onclick="this.closest('.modal').remove()">Cancel</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('quickReportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { user } = await window.AppUtil.requireAuth();
    
    await setDoc(doc(collection(db, 'reports')), {
      studentId,
      title: document.getElementById('quickReportTitle').value || 'Progress Report',
      strengths: document.getElementById('quickStrengths').value,
      lows: document.getElementById('quickLows').value,
      summary: document.getElementById('quickSummary').value,
      tutorId: user.uid,
      createdAt: serverTimestamp()
    });
    
    alert('Report saved!');
    modal.remove();
    location.reload();
  });
};

window.openCommentModal = (studentId, studentName) => {
  const comment = prompt(`Add comment for ${studentName}:`);
  if (comment) {
    (async () => {
      const { user } = await window.AppUtil.requireAuth();
      await setDoc(doc(collection(db, 'student-comments')), {
        studentId,
        comment,
        tutorId: user.uid,
        createdAt: serverTimestamp()
      });
      alert('Comment added!');
      location.reload();
    })();
  }
};

window.sendMessage = async (studentId, studentName) => {
  const message = document.getElementById(`reply-${studentId}`).value;
  if (!message) return;
  
  const { user } = await window.AppUtil.requireAuth();
  await setDoc(doc(collection(db, 'messages')), {
    tutorId: user.uid,
    studentId,
    studentName,
    message,
    sender: 'tutor',
    createdAt: serverTimestamp()
  });
  
  alert('Message sent!');
  location.reload();
};

window.deleteAssignment = async (id) => {
  if (confirm('Delete this assignment?')) {
    await deleteDoc(doc(db, 'assignments', id));
    location.reload();
  }
};

window.gradeSubmission = async (submissionId, assignmentId) => {
  const grade = document.getElementById(`grade-${submissionId}`).value;
  if (!grade) return;
  
  await updateDoc(doc(db, 'submissions', submissionId), {
    grade: parseInt(grade),
    gradedAt: serverTimestamp()
  });
  
  alert(`Grade ${grade} saved!`);
};

window.startTeachingMode = (classroomId, className) => {
  const modeDiv = document.getElementById(`teaching-mode-${classroomId}`);
  if (modeDiv) {
    modeDiv.style.display = 'block';
    alert(`Teaching mode started for ${className}`);
  }
};

window.endTeachingMode = (classroomId) => {
  const modeDiv = document.getElementById(`teaching-mode-${classroomId}`);
  if (modeDiv) {
    modeDiv.style.display = 'none';
    alert('Teaching mode ended');
  }
};

window.broadcastToClass = async (classroomId) => {
  const message = prompt('Enter broadcast message for the class:');
  if (message) {
    const classroomSnap = await getDoc(doc(db, 'classrooms', classroomId));
    const classroom = classroomSnap.data();
    
    for (const studentId of (classroom.studentIds || [])) {
      await setDoc(doc(collection(db, 'messages')), {
        studentId,
        message: `[CLASS BROADCAST] ${message}`,
        sender: 'tutor',
        classroomId,
        createdAt: serverTimestamp()
      });
    }
    alert(`Broadcast sent to ${classroom.studentIds?.length || 0} students!`);
  }
};

window.startLiveLesson = (classroomId) => {
  alert('Live lesson feature - would integrate with video conferencing API');
};

window.deleteClassroom = async (id) => {
  if (confirm('Delete this classroom? This will remove all student associations.')) {
    await deleteDoc(doc(db, 'classrooms', id));
    location.reload();
  }
};

window.deleteReport = async (id) => {
  if (confirm('Delete this report?')) {
    await deleteDoc(doc(db, 'reports', id));
    location.reload();
  }
};

window.editReport = async (id) => {
  const reportSnap = await getDoc(doc(db, 'reports', id));
  const report = reportSnap.data();
  
  const strengths = prompt('Edit strengths:', report.strengths);
  if (strengths !== null) {
    await updateDoc(doc(db, 'reports', id), {
      strengths,
      updatedAt: serverTimestamp()
    });
    location.reload();
  }
};

window.editLessonPlan = async (id) => {
  alert('Edit functionality - click the form to edit existing plans');
};

window.deleteLessonPlan = async (id) => {
  if (confirm('Delete this lesson plan?')) {
    await deleteDoc(doc(db, 'lesson-plans', id));
    location.reload();
  }
};

window.publishLessonPlan = async (id) => {
  const planSnap = await getDoc(doc(db, 'lesson-plans', id));
  const plan = planSnap.data();
  const newStatus = plan.status === 'Published' ? 'Draft' : 'Published';
  
  await updateDoc(doc(db, 'lesson-plans', id), {
    status: newStatus,
    updatedAt: serverTimestamp()
  });
  
  location.reload();
};

window.toggleThread = (studentId) => {
  const thread = document.getElementById(`thread-${studentId}`);
  if (thread) {
    thread.style.display = thread.style.display === 'none' ? 'block' : 'none';
  }
};

window.showAllReports = () => {
  alert(`Total reports: ${window.reportsData?.length || 0}`);
};

window.showAllComments = () => {
  alert(`Total comments: ${window.commentsData?.length || 0}`);
};

window.exportData = () => {
  const data = {
    students: window.studentsData,
    reports: window.reportsData,
    comments: window.commentsData,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `homeschool-data-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

window.viewStudentDetails = (studentId) => {
  const student = window.studentsData?.find(s => s.id === studentId);
  if (student) {
    alert(`
      Student: ${student.full_name || student.name}
      Email: ${student.email}
      Classroom: ${student.classroomName || 'Not assigned'}
      Role: ${student.role}
    `);
  }
};

// Override the page boot functions with complete versions
const originalBoot = {};

// Replace boot functions
window.bootLearnersPageComplete = () => {
  requireAuth().then(bundle => {
    if (bundle) refreshLearnersPageComplete(bundle);
  });
};

window.bootClassroomsPageComplete = () => {
  requireAuth().then(bundle => {
    if (bundle) refreshClassroomsPageComplete(bundle);
  });
};

window.bootAssignmentsPageComplete = () => {
  requireAuth().then(bundle => {
    if (bundle) refreshAssignmentsPageComplete(bundle);
  });
};

window.bootReportsPageComplete = () => {
  requireAuth().then(bundle => {
    if (bundle) refreshReportsPageComplete(bundle);
  });
};

window.bootMessagesPageComplete = () => {
  requireAuth().then(bundle => {
    if (bundle) refreshMessagesPageComplete(bundle);
  });
};

window.bootLessonPlansPageComplete = () => {
  requireAuth().then(bundle => {
    if (bundle) refreshLessonPlansPageComplete(bundle);
  });
};


