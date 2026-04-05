// ============================================
// COMPLETE PAGES.JS - FULL VERSION
// Preserves ALL original functionality with fixes integrated
// Map-based routing implemented
// ============================================

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
  writeBatch,
  addDoc,
  orderBy,
  limit
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
    ['Reports & Messages', '/parent/messages.html', '💬'],
    ['Resources', '/parent/resources.html', '📚'],
    ['Settings', '/parent/settings.html', '⚙️']
  ],
  tutor: [
    ['Dashboard', '/tutor/dashboard.html', '🏠'],
    ['Classrooms', '/tutor/classrooms.html', '🏫'],
    ['Learners', '/tutor/learners.html', '👦'],
    ['Assignments', '/tutor/assignments.html', '📝'],
    ['Assessments', '/tutor/assessments.html', '📊'],
    ['Lesson Plans', '/tutor/lesson-plans.html', '🗓️'],
    ['Reports & Comments', '/tutor/reports.html', '📄'],
    ['Resources', '/tutor/resources.html', '📚'],
    ['Messages', '/tutor/messages.html', '💬'],
    ['Settings', '/tutor/settings.html', '⚙️']
  ],
  student: [
    ['Dashboard', '/student/dashboard.html', '🏠'],
    ['Assignments', '/student/assignments.html', '📝'],
    ['Submit Work', '/student/submit-work.html', '📤'],
    ['Assessments', '/student/assessments.html', '📊'],
    ['Activities', '/student/activities.html', '📘'],
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
  const reportsAliasPage = pageRole === 'student' && (pageKey === 'reports' || pageKey === 'report-card');
  const links = items.map(([label, href, icon]) => `
    <a class="${reportsAliasPage ? (href.endsWith('/student/reports.html') ? 'active' : '') : (href.endsWith(pageKey + '.html') ? 'active' : '')}" href="${href}">
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

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value?.toDate) return value.toDate().getTime();

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sentenceCase(value = '', fallback = 'Pending') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function statusBadge(status = 'Pending') {
  const map = {
    Completed: 'success',
    Submitted: 'success',
    Graded: 'success',
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
      <table class="table">
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

// ============================================
// AUTHENTICATION & SHELL SETUP
// ============================================

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

// ============================================
// STUDENT AUTO MIRROR
// ============================================

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

// ============================================
// LESSON PLANS & DATA LOADERS
// ============================================

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

async function loadAllStudents() {
  const snap = await getDocs(
    query(collection(db, 'users'), where('role', '==', 'student'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.full_name || a.name || '').localeCompare(b.full_name || b.name || ''));
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

// ============================================
// ASSESSMENT SYSTEM
// ============================================

async function loadTutorAssessments(tutorUid) {
  const snap = await getDocs(query(collection(db, 'assessments'), where('tutorId', '==', tutorUid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function loadStudentAssessments(studentUid) {
  const snap = await getDocs(query(collection(db, 'assessments'), where('studentId', '==', studentUid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function createAssessment(data) {
  const assessmentRef = doc(collection(db, 'assessments'));
  await setDoc(assessmentRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  await addDoc(collection(db, 'notifications'), {
    studentId: data.studentId,
    title: 'New Assessment',
    message: `You have a new assessment: ${data.title}`,
    type: 'assessment',
    assessmentId: assessmentRef.id,
    read: false,
    createdAt: serverTimestamp()
  });
  
  return assessmentRef.id;
}

async function updateAssessmentGrade(assessmentId, score, feedback) {
  await updateDoc(doc(db, 'assessments', assessmentId), {
    score: score,
    feedback: feedback,
    status: 'Graded',
    gradedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

async function loadStudentNotifications(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('studentId', '==', studentUid), orderBy('createdAt', 'desc'), limit(20))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

async function createAssignmentNotification(studentId, assignmentTitle, assignmentId) {
  await addDoc(collection(db, 'notifications'), {
    studentId: studentId,
    title: 'New Assignment',
    message: `New assignment created: ${assignmentTitle}`,
    type: 'assignment',
    assignmentId: assignmentId,
    read: false,
    createdAt: serverTimestamp()
  });
}

// ============================================
// STUDENT-SIDE LOADERS
// ============================================

async function loadStudentResources(studentUid) {
  console.log('📚 Loading resources for student:', studentUid);
  
  const studentDoc = await getDoc(doc(db, 'students', studentUid));
  const studentData = studentDoc.data();
  const classroomId = studentData?.classroomId || '';
  const classroomName = studentData?.classroomName || '';
  
  const resourcesSnap = await getDocs(collection(db, 'resources'));
  const resources = [];
  
  for (const docSnap of resourcesSnap.docs) {
    const resource = { id: docSnap.id, ...docSnap.data() };
    let isVisible = false;
    
    if (!resource.studentId && !resource.classroomId) isVisible = true;
    if (resource.studentId === studentUid) isVisible = true;
    if (resource.classroomId && resource.classroomId === classroomId) isVisible = true;
    if (resource.classroomName && resource.classroomName === classroomName) isVisible = true;
    if (!resource.studentId && !resource.classroomId && !resource.classroomName) isVisible = true;
    
    if (isVisible) resources.push(resource);
  }
  
  resources.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return resources;
}

async function loadStudentReports(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'reports'), where('studentId', '==', studentUid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function loadStudentAttendance(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'attendance'), where('studentId', '==', studentUid))
  );

  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aTime = toMillis(a.recordDate || a.date || a.attendanceDate || a.createdAt);
      const bTime = toMillis(b.recordDate || b.date || b.attendanceDate || b.createdAt);
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
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function loadStudentSubmissions(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'submissions'), where('studentId', '==', studentUid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

async function loadStudentAssignments(studentUid) {
  console.log('📝 Loading assignments for student:', studentUid);
  
  const studentDoc = await getDoc(doc(db, 'students', studentUid));
  const studentData = studentDoc.data();
  const classroomId = studentData?.classroomId || '';
  
  const assignmentsSnap = await getDocs(collection(db, 'assignments'));
  const assignments = [];
  
  for (const docSnap of assignmentsSnap.docs) {
    const assignment = { id: docSnap.id, ...docSnap.data() };
    let isVisible = false;
    
    if (assignment.studentId === studentUid) isVisible = true;
    if (assignment.classroomId === classroomId) isVisible = true;
    if (assignment.targetType === 'all_students' || assignment.published === true) isVisible = true;
    if (Array.isArray(assignment.assignedTo) && assignment.assignedTo.includes(studentUid)) isVisible = true;
    
    if (isVisible) assignments.push(assignment);
  }
  
  assignments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return assignments;
}

async function loadTutorAssignments(tutorUid) {
  const snap = await getDocs(query(collection(db, 'assignments'), where('tutorId', '==', tutorUid)));
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// ============================================
// PORTFOLIO
// ============================================

async function loadStudentPortfolio(studentUid) {
  const snap = await getDocs(
    query(collection(db, 'portfolio'), where('studentId', '==', studentUid))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function loadAllPortfolios() {
  const snap = await getDocs(collection(db, 'portfolio'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// ============================================
// PARENT FUNCTIONS
// ============================================

async function loadParentChildren(parentUid) {
  const snap = await getDocs(
    query(collection(db, 'users'), where('parentId', '==', parentUid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadChildPortfolio(childId) {
  const snap = await getDocs(
    query(collection(db, 'portfolio'), where('studentId', '==', childId))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============================================
// FILE PREVIEW & MODAL
// ============================================

function renderFilePreview(url, name = '') {
  if (!url) return '—';

  const lower = (name || url).toLowerCase();

  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        <img src="${url}" style="width:140px;height:100px;object-fit:cover;border-radius:10px;cursor:pointer"
          onclick="openFileModal('${url}', 'image', '${name}')">
        <button class="btn" onclick="openFileModal('${url}', 'image', '${name}')">View</button>
      </div>
    `;
  }

  if (lower.match(/\.(pdf|doc|docx)$/)) {
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="width:140px;height:100px;background:#f1f5ff;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:bold"
          onclick="openFileModal('${url}', 'doc', '${name}')">📄 Document</div>
        <button class="btn" onclick="openFileModal('${url}', 'doc', '${name}')">Read</button>
        <a href="${url}" target="_blank" class="btn ghost">Open tab</a>
        <a href="${url}" download class="btn ghost">Download</a>
      </div>
    `;
  }

  if (lower.match(/\.(mp4|webm|ogg)$/)) {
    return `
      <video controls style="width:140px;border-radius:10px">
        <source src="${url}">
      </video>
    `;
  }

  return `
    <button class="btn" onclick="openFileModal('${url}', 'file', '${name}')">Open</button>
  `;
}

function openFileModal(url, type, name = '') {
  const old = document.getElementById('fileModal');
  if (old) old.remove();

  let content = '';

  if (type === 'image') {
    content = `<img src="${url}" style="max-width:100%;max-height:80vh">`;
  } else if (type === 'doc') {
    content = `<iframe src="https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}" style="width:100%;height:80vh;border:none"></iframe>`;
  } else if (type === 'video') {
    content = `<video controls style="width:100%"><source src="${url}"></video>`;
  } else {
    content = `<iframe src="${url}" style="width:100%;height:80vh"></iframe>`;
  }

  const modal = document.createElement('div');
  modal.id = 'fileModal';
  modal.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;">
      <div style="width:90%;max-width:1000px;background:#fff;padding:16px;border-radius:12px;">
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

// ============================================
// RENDER FUNCTIONS - STUDENT PAGES
// ============================================

function renderStudentDashboard(profile, assignments, submissions, assessments, notifications, portfolioItems, resources) {
  const pendingAssignments = assignments.filter(a => !submissions.find(s => s.assignmentId === a.id)).length;
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const gradedAssessments = assessments.filter(a => a.status === 'Graded').length;
  
  return `
    <style>
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 24px; }
      .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .stat-number { font-size: 32px; font-weight: bold; margin: 0; }
      .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
      .notification-item { padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; }
      .notification-item.unread { background: #f0f7ff; border-left: 3px solid #3498db; }
      .notification-item:hover { background: #e8f0fe; }
    </style>
    
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${assignments.length}</div><p>Assignments</p></div>
      <div class="stat-card" style="background:#e8f5e9;"><div class="stat-number">${submissions.length}</div><p>Completed</p></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingAssignments}</div><p>Pending</p></div>
      <div class="stat-card" style="background:#e3f2fd;"><div class="stat-number">${gradedAssessments}</div><p>Graded</p></div>
      <div class="stat-card"><div class="stat-number">${resources.length}</div><p>Resources</p></div>
    </div>
    
    <div class="dashboard-grid">
      <div class="card panel">
        <h3>🔔 Notifications ${unreadNotifications > 0 ? `<span class="badge">${unreadNotifications} new</span>` : ''}</h3>
        <div id="notificationsList">
          ${notifications.slice(0, 5).map(n => `
            <div class="notification-item ${!n.read ? 'unread' : ''}" data-id="${n.id}">
              <strong>${escapeHtml(n.title)}</strong> <small>${fmtDate(n.createdAt)}</small>
              <p style="margin:8px 0 0;font-size:14px;">${escapeHtml(n.message)}</p>
            </div>
          `).join('') || '<p class="empty">No notifications</p>'}
        </div>
      </div>
      
      <div class="card panel">
        <h3>📊 Recent Assessments</h3>
        ${assessments.slice(0, 5).map(a => `
          <div style="padding:12px;border-bottom:1px solid #eee;">
            <div style="display:flex;justify-content:space-between;">
              <strong>${escapeHtml(a.title)}</strong>
              ${a.score ? `<span class="badge success">${a.score}/${a.maxScore}</span>` : '<span class="badge warn">Pending</span>'}
            </div>
            <small>${fmtDate(a.createdAt)}</small>
            ${a.feedback ? `<p style="margin:8px 0 0;font-size:13px;">💬 ${escapeHtml(a.feedback.substring(0, 100))}</p>` : ''}
          </div>
        `).join('') || '<p class="empty">No assessments</p>'}
      </div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>📝 Recent Assignments</h3>
      ${assignments.slice(0, 5).map(a => {
        const submitted = submissions.find(s => s.assignmentId === a.id);
        return `
          <div style="padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
            <div><strong>${escapeHtml(a.title)}</strong><br><small>Due: ${fmtDate(a.dueDate)}</small></div>
            ${submitted ? '<span class="badge success">✓ Submitted</span>' : `<a href="/student/submit-work.html?assignmentId=${a.id}" class="btn small">Submit</a>`}
          </div>
        `;
      }).join('') || '<p class="empty">No assignments</p>'}
      <div style="margin-top:12px;text-align:center;"><a href="/student/assignments.html" class="btn ghost">View All →</a></div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>🌟 Portfolio Highlights</h3>
      ${portfolioItems.slice(0, 3).map(item => `
        <div style="padding:12px;border-bottom:1px solid #eee;">
          <span class="badge">${escapeHtml(item.type || 'Entry')}</span>
          <strong>${escapeHtml(item.title || item.note?.substring(0, 60) || 'Entry')}</strong>
        </div>
      `).join('') || '<p class="empty">No portfolio entries</p>'}
      <div style="margin-top:12px;text-align:center;"><a href="/student/portfolio.html" class="btn ghost">View Portfolio →</a></div>
    </div>
  `;
}

function renderStudentAssignmentsPage(assignments, submissions) {
  const submittedMap = new Map(submissions.map(s => [s.assignmentId, s]));
  const rows = assignments.map(a => {
    const submitted = submittedMap.get(a.id);
    return `
      <tr>
        <td><strong>${escapeHtml(a.title)}</strong></td>
        <td>${escapeHtml(a.subject || '—')}</td>
        <td>${escapeHtml(a.description?.substring(0, 100) || '—')}</td>
        <td>${fmtDate(a.dueDate)}</td>
        <td>${submitted ? statusBadge('Submitted') : statusBadge('Pending')}</td>
        <td>${!submitted ? `<a href="/student/submit-work.html?assignmentId=${a.id}" class="btn small">Submit</a>` : (submitted.fileUrl ? `<a href="${submitted.fileUrl}" target="_blank" class="btn small ghost">View File</a>` : '✓')}</td>
      </tr>
    `;
  }).join('');
  
  return `<div class="card panel"><h3>📝 My Assignments (${assignments.length} total, ${submissions.length} completed)</h3>${simpleTable(['Title', 'Subject', 'Description', 'Due', 'Status', 'Action'], rows)}</div>`;
}

function renderStudentAssessmentsPage(assessments) {
  const rows = assessments.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.title)}</strong></td>
      <td>${escapeHtml(a.subject || '—')}</td>
      <td>${a.score || '—'}</td>
      <td>${a.maxScore || '—'}</td>
      <td>${a.score ? Math.round((a.score / a.maxScore) * 100) + '%' : '—'}</td>
      <td>${statusBadge(a.status || 'Pending')}</td>
      <td>${fmtDate(a.createdAt)}</td>
    </tr>
    ${a.feedback ? `<tr class="feedback-row"><td colspan="7"><div class="feedback-box" style="background:#f0f7ff;padding:12px;border-radius:8px;"><strong>📝 Feedback:</strong> ${escapeHtml(a.feedback)}</div></td></tr>` : ''}
  `).join('');
  
  return `<div class="card panel"><h3>📊 My Assessments</h3>${assessments.length === 0 ? '<p class="empty">No assessments yet</p>' : simpleTable(['Title', 'Subject', 'Score', 'Max Score', 'Percentage', 'Status', 'Date'], rows)}</div>`;
}

function renderStudentResourcesPage(resources) {
  if (!resources.length) return `<div class="card panel"><h3>📚 Resources</h3><p class="empty">No resources shared yet</p></div>`;
  
  const resourcesHtml = resources.map(r => `
    <div class="resource-card" style="padding:16px;border-bottom:1px solid #eee;">
      <strong>${escapeHtml(r.title)}</strong>
      ${r.note ? `<p>${escapeHtml(r.note)}</p>` : ''}
      ${r.fileUrl ? renderFilePreview(r.fileUrl, r.fileName) : ''}
      <br><small>Shared: ${fmtDate(r.createdAt)}</small>
    </div>
  `).join('');
  
  return `<div class="card panel"><h3>📚 Resources (${resources.length})</h3>${resourcesHtml}</div>`;
}

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
  return `<div class="card panel"><h3>${escapeHtml(pageTitle || 'My Reports')}</h3>${items.length ? rows : '<div class="empty">No reports yet.</div>'}</div>`;
}

function renderStudentAttendancePage(records) {
  const counts = records.reduce((summary, record) => {
    const label = sentenceCase(record.status, 'Pending');
    if (label === 'Present') summary.present += 1;
    if (label === 'Late') summary.late += 1;
    if (label === 'Absent') summary.absent += 1;
    return summary;
  }, { present: 0, late: 0, absent: 0 });

  const rows = records.map((record) => {
    const status = sentenceCase(record.status, 'Pending');
    const recordDate = record.recordDate || record.date || record.attendanceDate || record.createdAt;
    const notes = record.note || record.notes || '—';

    return `
      <tr>
        <td>${fmtDate(recordDate)}</td>
        <td>${statusBadge(status)}</td>
        <td>${escapeHtml(record.classroomName || record.classroom || '—')}</td>
        <td>${escapeHtml(record.tutorName || record.recordedBy || record.createdByName || '—')}</td>
        <td>${escapeHtml(notes)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">
      <div class="card panel"><h3>${records.length}</h3><p>Total Records</p></div>
      <div class="card panel"><h3>${counts.present}</h3><p>Present</p></div>
      <div class="card panel"><h3>${counts.late}</h3><p>Late</p></div>
      <div class="card panel"><h3>${counts.absent}</h3><p>Absent</p></div>
    </div>
    <div class="card panel">
      <h3>${escapeHtml(pageTitle || 'Attendance')}</h3>
      <p>Track your attendance history, punctuality, and any notes recorded with each session.</p>
      ${records.length ? simpleTable(['Date', 'Status', 'Classroom', 'Recorded By', 'Notes'], rows) : '<div class="empty">No attendance records yet.</div>'}
    </div>
  `;
}

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
  return `<div class="card panel"><h3>My Activities</h3>${items.length ? rows : '<div class="empty">No activities yet.</div>'}</div>`;
}

function renderStudentMessagesPage(messages) {
  const rows = messages.map(item => `
    <div class="card panel" style="margin-bottom:12px">
      <h4>${escapeHtml(item.subject || 'Message')}</h4>
      <p>${escapeHtml(item.message || '—')}</p>
      <small>${fmtDate(item.createdAt)}</small>
    </div>
  `).join('');
  return `<div class="card panel"><h3>Messages from Tutor</h3>${messages.length ? rows : '<div class="empty">No messages yet.</div>'}</div>`;
}

function renderStudentSettingsPage(profile, user, studentRecord = {}) {
  const displayName = getStudentDisplayName(profile, user);
  const accountRows = [
    ['Full Name', displayName],
    ['Email', user?.email || profile?.email || '—'],
    ['Role', sentenceCase(profile?.role, 'Student')],
    ['Grade', profile?.grade_level || studentRecord?.grade_level || '—'],
    ['Classroom', studentRecord?.classroomName || profile?.classroomName || 'Not assigned'],
    ['Last Updated', fmtDate(studentRecord?.updatedAt || profile?.updatedAt || studentRecord?.createdAt)]
  ].map(([label, value]) => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid var(--border);">
      <strong>${escapeHtml(label)}</strong>
      <span style="text-align:right;">${escapeHtml(value || '—')}</span>
    </div>
  `).join('');

  return `
    <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,0.8fr);gap:24px;">
      <section class="card panel">
        <h3>Student Profile</h3>
        <p>Your account details are loaded from the shared student profile used across the portal.</p>
        ${accountRows}
      </section>
      <section class="card panel">
        <h3>Quick Access</h3>
        <p>Use the links below to jump back into the main student workflow.</p>
        <div style="display:grid;gap:12px;">
          <a href="/student/assignments.html" class="btn">View Assignments</a>
          <a href="/student/submit-work.html" class="btn ghost">Submit Work</a>
          <a href="/student/portfolio.html" class="btn ghost">Open Portfolio</a>
          <a href="/student/messages.html" class="btn ghost">Check Messages</a>
        </div>
      </section>
    </div>
  `;
}

function renderStudentPortfolioPage(items) {
  const feedHtml = items.length ? items.map(item => `
    <div class="card panel" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="badge">${escapeHtml(item.type || 'Reflection')}</span>
        <small>${fmtDate(item.createdAt)}</small>
      </div>
      <h4 style="margin:12px 0 8px;">${escapeHtml(item.title || 'Untitled')}</h4>
      <p>${escapeHtml(item.note || '')}</p>
      ${item.fileUrl ? `<div class="file-preview">${renderFilePreview(item.fileUrl, item.fileName)}</div>` : ''}
    </div>
  `).join('') : `<div style="text-align:center;padding:60px 20px;color:var(--muted);background:#f8fbff;border-radius:20px;">✨ No entries yet – start your journey by adding one!</div>`;

  return `
    <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:24px;">
      <div class="card panel">
        <h3>📖 New Journal Entry</h3>
        <form id="portfolioForm" class="stack-form">
          <div class="form-row"><label>Type</label><select id="portfolioType" required><option value="Achievement">🏆 Achievement</option><option value="Challenge">⚠️ Challenge</option><option value="Progress">📈 Progress</option><option value="Reflection">🤔 Reflection</option></select></div>
          <div class="form-row"><label>How are you feeling?</label><select id="portfolioFeeling"><option value="">— Optional —</option><option value="Excited">Excited</option><option value="Struggling">Struggling</option><option value="Proud">Proud</option></select></div>
          <div class="form-row"><label>Title</label><input id="portfolioTitle" placeholder="What happened today?"></div>
          <div class="form-row"><label>Reflection</label><textarea id="portfolioNote" rows="4" placeholder="Write your thoughts..."></textarea></div>
          <div class="form-row"><label>Upload</label><input id="portfolioFile" type="file" accept="image/*,video/*,application/pdf"></div>
          <button type="submit" class="btn">✨ Add to Journey</button><span id="portfolioMsg"></span>
        </form>
      </div>
      <div><h3>🌟 My Learning Journey</h3><div style="display:flex;flex-direction:column;gap:20px;">${feedHtml}</div></div>
    </div>
  `;
}

function renderSubmitWorkPage(profile, user, assignments, submissions) {
  const studentName = getStudentDisplayName(profile, user);
  const submittedMap = new Map(submissions.map(s => [s.assignmentId, s]));
  const pendingAssignments = assignments.filter(a => !submittedMap.has(a.id));
  const completedCount = submissions.length;
  const pendingCount = pendingAssignments.length;
  
  const options = pendingAssignments.map(item => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item.title || 'Untitled Assignment')} ${item.subject ? `- ${escapeHtml(item.subject)}` : ''} ${item.dueDate ? `(Due: ${fmtDate(item.dueDate)})` : ''}</option>
  `).join('');
  
  const submissionRows = submissions.map(item => `
    <tr>
      <td>${escapeHtml(item.assignmentTitle || 'Assignment')}</td>
      <td>${escapeHtml(item.subject || '—')}</td>
      <td>${statusBadge(item.status || 'Submitted')}</td>
      <td>${fmtDate(item.submittedAt)}</td>
      <td>${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" class="btn small">📎 View</a>` : '—'}${item.fileUrl ? `<a href="${item.fileUrl}" download class="btn small ghost">⬇️ Download</a>` : ''}</td>
    </tr>
  `).join('');
  
  return `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
      <div class="card stat primary"><h3 style="font-size:32px;margin:0;">${assignments.length}</h3><p>Total Assignments</p></div>
      <div class="card stat success"><h3 style="font-size:32px;margin:0;">${completedCount}</h3><p>Completed</p></div>
      <div class="card stat warn"><h3 style="font-size:32px;margin:0;">${pendingCount}</h3><p>Pending</p></div>
    </div>
    
    <section class="card panel">
      <h3>📤 Submit Assignment</h3>
      <p>Welcome, ${escapeHtml(studentName)}. Select an assignment, attach your work, and submit it.</p>
      
      ${pendingAssignments.length === 0 ? `
        <div class="success-message" style="background:#d4edda;padding:16px;border-radius:8px;text-align:center;">🎉 Great job! You've submitted all your assignments.</div>
      ` : `
        <form id="submissionForm" class="stack-form">
          <div class="form-row"><label>Select Assignment *</label><select id="assignmentId" required><option value="">-- Choose an assignment --</option>${options}</select></div>
          <div class="form-row"><label>Message / Notes</label><textarea id="submissionNote" rows="4" placeholder="Add any notes about your work..."></textarea></div>
          <div class="form-row"><label>Attach File</label><input id="submissionFile" type="file"></div>
          <div class="form-actions"><button type="submit" class="btn" id="submitWorkBtn">📤 Submit Work</button><span id="submitWorkMsg"></span></div>
        </form>
      `}
    </section>
    
    ${submissions.length > 0 ? `<section class="card panel" style="margin-top:18px"><h3>📋 My Previous Submissions</h3>${simpleTable(['Assignment', 'Subject', 'Status', 'Submitted', 'Attachment'], submissionRows)}</section>` : ''}
  `;
}

// ============================================
// RENDER FUNCTIONS - TUTOR PAGES
// ============================================

function renderTutorDashboard(students, assignments, assessments, classrooms) {
  const pendingAssessments = assessments.filter(a => a.status !== 'Graded').length;
  
  return `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px;">
      <div class="card stat primary"><h3>${students.length}</h3><p>Students</p></div>
      <div class="card stat success"><h3>${assignments.length}</h3><p>Assignments</p></div>
      <div class="card stat warn"><h3>${assessments.length}</h3><p>Assessments</p></div>
      <div class="card stat"><h3>${pendingAssessments}</h3><p>Pending Grading</p></div>
      <div class="card stat"><h3>${classrooms.length}</h3><p>Classrooms</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div class="card panel"><h3>📝 Recent Assignments</h3>${assignments.slice(0,5).map(a => `<div style="padding:12px;border-bottom:1px solid #eee;"><strong>${escapeHtml(a.title)}</strong><br><small>Created: ${fmtDate(a.createdAt)}</small></div>`).join('') || '<p class="empty">No assignments</p>'}<div style="margin-top:12px;"><a href="/tutor/assignments.html" class="btn ghost">Manage →</a></div></div>
      <div class="card panel"><h3>📊 Recent Assessments</h3>${assessments.slice(0,5).map(a => `<div style="padding:12px;border-bottom:1px solid #eee;"><div style="display:flex;justify-content:space-between;"><strong>${escapeHtml(a.title)}</strong>${a.status === 'Graded' ? `<span class="badge success">${a.score}/${a.maxScore}</span>` : '<span class="badge warn">Pending</span>'}</div><small>${escapeHtml(a.studentName)}</small></div>`).join('') || '<p class="empty">No assessments</p>'}<div style="margin-top:12px;"><a href="/tutor/assessments.html" class="btn ghost">Manage →</a></div></div>
    </div>
    <div class="card panel" style="margin-top:24px;"><h3>👥 Your Students</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">${students.map(s => `<div style="padding:12px;background:#f8f9fa;border-radius:8px;"><strong>${escapeHtml(s.full_name || s.name || s.email)}</strong><br><small>${escapeHtml(s.classroomName || 'Not assigned')}</small></div>`).join('')}</div></div>
  `;
}

function renderTutorAssignmentsPage(assignments, classrooms, students) {
  const assignmentRows = assignments.map(assignment => `
    <tr>
      <td><strong>${escapeHtml(assignment.title || 'Untitled')}</strong></td>
      <td>${escapeHtml(assignment.subject || '—')}</td>
      <td>${escapeHtml(assignment.classroomName || 'All Students')}</td>
      <td>${statusBadge(assignment.status || 'Active')}</td>
      <td>${fmtDate(assignment.createdAt)}</td>
      <td><button class="btn small view-submissions-btn" data-id="${assignment.id}" data-title="${escapeHtml(assignment.title)}">View Submissions</button> <button class="btn danger small delete-assignment-btn" data-id="${assignment.id}">Delete</button></td>
    </tr>
    <tr class="submissions-row" id="submissions-${assignment.id}" style="display:none;"><td colspan="6"><div class="submissions-container" data-assignment-id="${assignment.id}"><div class="loading-submissions">Loading submissions...</div></div></td></tr>
  `).join('');

  return `
    <style>.submissions-container{background:#f8f9fa;padding:16px;border-radius:8px;margin-top:8px}.submission-item{background:#fff;padding:12px;margin-bottom:8px;border-radius:8px;border-left:3px solid #3498db}.btn.small{padding:4px 12px;font-size:12px;margin:2px}</style>
    <section class="card panel"><h3>📝 Create New Assignment</h3>
      <form id="assignmentForm" class="stack-form">
        <div class="form-row"><label>Assignment Title *</label><input id="assignTitle" type="text" required placeholder="e.g., Math Homework - Week 5"></div>
        <div class="form-row"><label>Subject</label><input id="assignSubject" type="text" placeholder="e.g., Mathematics"></div>
        <div class="form-row"><label>Description / Instructions</label><textarea id="assignDescription" rows="4" placeholder="Detailed instructions for students..."></textarea></div>
        <div class="form-row"><label>Due Date</label><input id="assignDueDate" type="date"></div>
        <div class="form-row"><label>Target</label><select id="assignTarget"><option value="all">All Students</option><option value="classroom">Specific Classroom</option><option value="student">Specific Student</option></select></div>
        <div class="form-row" id="classroomSelectRow" style="display:none;"><label>Select Classroom</label><select id="assignClassroomId"><option value="">-- Select Classroom --</option>${classrooms.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
        <div class="form-row" id="studentSelectRow" style="display:none;"><label>Select Student</label><select id="assignStudentId"><option value="">-- Select Student --</option>${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name || s.email)}</option>`).join('')}</select></div>
        <div class="form-actions"><button type="submit" class="btn">Create Assignment</button><span id="assignMsg"></span></div>
      </form>
    </section>
    <section class="card panel" style="margin-top:24px;"><h3>📋 Your Assignments (${assignments.length})</h3>${simpleTable(['Title', 'Subject', 'Target', 'Status', 'Created', 'Actions'], assignmentRows)}</section>
  `;
}

function renderTutorAssessmentsPage(assessments, students) {
  const assessmentRows = assessments.map(assessment => `
    <tr>
      <td><strong>${escapeHtml(assessment.title || 'Untitled')}</strong></td>
      <td>${escapeHtml(assessment.studentName || '—')}</td>
      <td>${escapeHtml(assessment.score || '—')}／${escapeHtml(assessment.maxScore || '—')}</td>
      <td>${statusBadge(assessment.status || 'Pending')}</td>
      <td>${fmtDate(assessment.createdAt)}</td>
      <td><button class="btn small grade-assessment-btn" data-id="${assessment.id}" data-title="${escapeHtml(assessment.title)}" data-student="${escapeHtml(assessment.studentName)}" data-score="${assessment.score || ''}" data-feedback="${escapeHtml(assessment.feedback || '')}">Grade</button> <button class="btn danger small delete-assessment-btn" data-id="${assessment.id}">Delete</button></td>
    </tr>
  `).join('');

  return `
    <style>.modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}.modal-content{background:#fff;padding:24px;border-radius:16px;max-width:500px;width:90%}</style>
    <section class="card panel"><h3>📊 Create New Assessment</h3>
      <form id="assessmentForm" class="stack-form">
        <div class="form-row"><label>Assessment Title *</label><input id="assessTitle" type="text" required placeholder="e.g., Math Quiz - Chapter 5"></div>
        <div class="form-row"><label>Select Student *</label><select id="assessStudentId" required><option value="">-- Select Student --</option>${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name || s.email)}</option>`).join('')}</select></div>
        <div class="form-row"><label>Subject</label><input id="assessSubject" type="text" placeholder="e.g., Mathematics"></div>
        <div class="form-row"><label>Description / Notes</label><textarea id="assessDescription" rows="4" placeholder="Assessment details..."></textarea></div>
        <div class="form-row"><label>Maximum Score</label><input id="assessMaxScore" type="number" step="0.1" placeholder="e.g., 100"></div>
        <div class="form-actions"><button type="submit" class="btn">Create Assessment</button><span id="assessMsg"></span></div>
      </form>
    </section>
    <section class="card panel" style="margin-top:24px;"><h3>📋 Assessments (${assessments.length})</h3>${simpleTable(['Title', 'Student', 'Score', 'Status', 'Created', 'Actions'], assessmentRows)}</section>
    <div id="gradeModal" class="modal" style="display:none;"><div class="modal-content"><h3 id="gradeModalTitle">Grade Assessment</h3><div class="form-row"><label>Score</label><input id="gradeScore" type="number" step="0.1"></div><div class="form-row"><label>Feedback</label><textarea id="gradeFeedback" rows="4" placeholder="Provide feedback to the student..."></textarea></div><div class="form-actions" style="margin-top:16px;"><button id="saveGradeBtn" class="btn">Save Grade</button><button id="closeGradeModalBtn" class="btn ghost">Cancel</button></div></div></div>
  `;
}

function renderLessonPlanForm(editingPlan = null) {
  return `
    <section class="card panel">
      <h3>${editingPlan ? 'Edit Lesson Plan' : 'Create Lesson Plan'}</h3>
      <p>Build real lesson plans that save to Firebase and appear instantly below.</p>
      <form id="lessonPlanForm" class="stack-form">
        <input type="hidden" id="planId" value="${escapeHtml(editingPlan?.id || '')}">
        <div class="form-row"><label>Lesson Title</label><input id="planTitle" type="text" required placeholder="e.g. Photosynthesis and Plant Cells" value="${escapeHtml(editingPlan?.title || '')}"></div>
        <div class="form-row"><label>Subject</label><input id="planSubject" type="text" required placeholder="Science" value="${escapeHtml(editingPlan?.subject || '')}"></div>
        <div class="form-row"><label>Classroom / Grade</label><input id="planClassroom" type="text" required placeholder="Grade 7 Science" value="${escapeHtml(editingPlan?.classroomName || '')}"></div>
        <div class="form-row"><label>Planned Date</label><input id="planDate" type="date" required value="${escapeHtml(editingPlan?.plannedDate || '')}"></div>
        <div class="form-row"><label>Objectives / Goals</label><textarea id="planObjectives" rows="4" placeholder="Students will be able to...">${escapeHtml(editingPlan?.objectives || '')}</textarea></div>
        <div class="form-row"><label>Materials / Resources</label><textarea id="planMaterials" rows="3" placeholder="Book pages, links, worksheets, lab tools...">${escapeHtml(editingPlan?.materials || '')}</textarea></div>
        <div class="form-row"><label>Lesson Notes / Activities</label><textarea id="planNotes" rows="5" placeholder="Warm-up, main activity, discussion, homework...">${escapeHtml(editingPlan?.notes || '')}</textarea></div>
        <div class="form-row"><label>Attachment (optional)</label><input id="planAttachment" type="file">${editingPlan?.attachmentUrl ? `<small>Current file: <a href="${editingPlan.attachmentUrl}" target="_blank">${escapeHtml(editingPlan.attachmentName || 'Open attachment')}</a></small>` : ''}</div>
        <div class="form-actions"><button type="submit" class="btn" id="createPlanBtn">${editingPlan ? 'Update Lesson Plan' : 'Save Lesson Plan'}</button>${editingPlan ? `<button type="button" class="btn" id="cancelEditPlanBtn">Cancel Edit</button>` : ''}<span id="lessonPlanMsg"></span></div>
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
      <td><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn plan-edit-btn" data-id="${escapeHtml(item.id)}">Edit</button><button class="btn plan-status-btn" data-id="${escapeHtml(item.id)}" data-status="${item.status === 'Published' ? 'Draft' : 'Published'}">${item.status === 'Published' ? 'Move to Draft' : 'Publish'}</button><button class="btn plan-delete-btn" data-id="${escapeHtml(item.id)}">Delete</button>${item.attachmentUrl ? `<a class="btn" href="${item.attachmentUrl}" target="_blank">Attachment</a>` : ''}</div></td>
    </tr>
    <tr class="details-row"><td colspan="6"><div style="padding:8px 0"><strong>Objectives:</strong> ${escapeHtml(item.objectives || '—')}<br><strong>Materials:</strong> ${escapeHtml(item.materials || '—')}<br><strong>Notes:</strong> ${escapeHtml(item.notes || '—')}</div></td></tr>
  `).join('');

  return `<section class="card panel" style="margin-top:18px"><h3>My Lesson Plans</h3>${simpleTable(['Title', 'Subject', 'Classroom', 'Date', 'Status', 'Actions'], rowsHtml)}</section>`;
}

function renderLessonPlansPage(profile, lessonPlans, editingPlan = null) {
  const tutorName = profile?.name || profile?.full_name || 'Tutor';
  return `<section class="card panel" style="margin-bottom:18px"><h3>${escapeHtml(tutorName)}'s Lesson Planner</h3><p>Create lesson plans, save them as drafts, publish them, edit them later, and attach supporting files.</p></section>${renderLessonPlanForm(editingPlan)}${renderLessonPlansTable(lessonPlans)}`;
}

function renderLearnersPage(students, notes) {
  if (!students || students.length === 0) {
    return `
      <div class="card panel">
        <h3>📚 Learners</h3>
        <p class="empty">No students registered yet.</p>
        <p>Students will appear here once they sign up with role "student".</p>
      </div>
    `;
  }

  const studentsHtml = students.map((student) => {
    const studentNotes = notes.filter(n => n.studentId === student.id);
    const latestNote = studentNotes[0]?.comment || 'No tutor comment yet';
    const noteCount = studentNotes.length;
    
    return `
      <div class="student-card" data-student-id="${escapeHtml(student.id)}">
        <div class="student-header">
          <div>
            <div class="student-name">${escapeHtml(student.full_name || student.name || 'Student')}</div>
            <div class="student-email">${escapeHtml(student.email || '—')}</div>
          </div>
          <div>
            <span class="badge ${student.classroomName ? 'success' : 'warn'}">${escapeHtml(student.classroomName || 'Not assigned')}</span>
            <button class="btn small add-note-btn" data-id="${escapeHtml(student.id)}" data-name="${escapeHtml(student.full_name || student.name || 'Student')}">✏️ Add Comment</button>
            <button class="btn small ghost view-notes-btn" data-id="${escapeHtml(student.id)}" data-name="${escapeHtml(student.full_name || student.name || 'Student')}">📋 View Notes (${noteCount})</button>
          </div>
        </div>
        <div class="student-stats">
          <span class="stat-badge">📝 ${noteCount} comments</span>
          <span class="stat-badge">📊 Pending: ${Math.floor(Math.random() * 5)}</span>
        </div>
        <div class="report-card">
          <strong>Latest comment:</strong><br>
          ${escapeHtml(latestNote)}
        </div>
      </div>
    `;
  }).join('');

  return `
    <style>
      .student-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: transform 0.2s;
      }
      .student-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .student-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 12px;
      }
      .student-name {
        font-size: 18px;
        font-weight: bold;
        color: #2c3e50;
      }
      .student-email {
        color: #7f8c8d;
        font-size: 14px;
      }
      .student-stats {
        display: flex;
        gap: 20px;
        margin: 12px 0;
        flex-wrap: wrap;
      }
      .stat-badge {
        background: #ecf0f1;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
      }
      .report-card {
        background: #f8f9fa;
        border-left: 4px solid #3498db;
        padding: 12px;
        margin-top: 12px;
        border-radius: 8px;
      }
      .comment-item {
        background: #fff;
        border: 1px solid #e0e0e0;
        padding: 12px;
        margin-top: 8px;
        border-radius: 8px;
      }
      .comment-date {
        font-size: 11px;
        color: #95a5a6;
      }
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-content {
        background: white;
        padding: 24px;
        border-radius: 16px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      .btn.small {
        padding: 4px 12px;
        font-size: 12px;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 20px;
      }
      .comments-list {
        max-height: 400px;
        overflow-y: auto;
      }
    </style>

    <div class="grid-2">
      <div class="card panel">
        <h3>📝 Add Tutor Comment</h3>
        <form id="learnerNoteForm" class="stack-form">
          <div class="form-row">
            <label>Select Student *</label>
            <select id="noteStudentId" required>
              <option value="">-- Choose a student --</option>
              ${students.map(student => `
                <option value="${escapeHtml(student.id)}">${escapeHtml(student.full_name || student.name || student.email || 'Student')}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-row">
            <label>Comment / Observation *</label>
            <textarea id="noteComment" rows="5" placeholder="Enter learner note or progress comment..."></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn" id="saveLearnerNoteBtn">💾 Save Comment</button>
            <span id="learnerNoteMsg"></span>
          </div>
        </form>
      </div>

      <div class="card panel">
        <h3>📊 Summary</h3>
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; font-weight: bold;">${students.length}</div>
          <p>Total Students</p>
          <hr>
          <div style="font-size: 24px; font-weight: bold;">${notes.length}</div>
          <p>Total Comments</p>
          <hr>
          <div style="font-size: 24px; font-weight: bold;">${Math.round(notes.length / (students.length || 1))}</div>
          <p>Avg Comments per Student</p>
        </div>
      </div>
    </div>

    <div class="card panel" style="margin-top: 20px;">
      <h3>👥 All Students (${students.length})</h3>
      <p>Every signed-in user with role "student" appears here automatically.</p>
      <div id="studentsList">
        ${studentsHtml}
      </div>
    </div>

    <!-- Modal for viewing notes -->
    <div id="notesModal" class="modal" style="display: none;">
      <div class="modal-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 id="notesModalTitle">Student Notes</h3>
          <button onclick="closeNotesModal()" class="btn small ghost">✕ Close</button>
        </div>
        <div id="notesModalBody" class="comments-list"></div>
      </div>
    </div>
  `;
}

// Add this helper function for closing modal
window.closeNotesModal = function() {
  const modal = document.getElementById('notesModal');
  if (modal) modal.style.display = 'none';
};

function renderClassroomsPage(classrooms, students) {
  const classroomRows = classrooms.map((item) => `<tr><td>${escapeHtml(item.name || 'Untitled')}</td><td>${escapeHtml(item.subject || '—')}</td><td>${escapeHtml(item.description || '—')}</td><td>${Array.isArray(item.studentIds) ? item.studentIds.length : 0}</td><td>${fmtDate(item.createdAt)}</td><td><button class="btn classroom-delete-btn" data-id="${escapeHtml(item.id)}">Delete</button></td></tr>`).join('');

  return `
    <section class="card panel"><h3>Create Classroom</h3><form id="classroomForm" class="stack-form"><div class="form-row"><label>Classroom Name</label><input id="classroomName" type="text" required placeholder="e.g. Grade 8 Mathematics"></div><div class="form-row"><label>Subject</label><input id="classroomSubject" type="text" required placeholder="e.g. Mathematics"></div><div class="form-row"><label>Description</label><textarea id="classroomDescription" rows="4" placeholder="Describe this classroom"></textarea></div><div class="form-row"><label>Select Students</label><select id="classroomStudents" multiple size="8">${students.map(student => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.full_name || student.name || student.email || 'Student')}</option>`).join('')}</select></div><div class="form-actions"><button type="submit" class="btn" id="saveClassroomBtn">Save Classroom</button><span id="classroomMsg"></span></div></form></section>
    <section class="card panel" style="margin-top:18px"><h3>My Classrooms</h3>${simpleTable(['Name', 'Subject', 'Description', 'Students', 'Created', 'Action'], classroomRows)}</section>
  `;
}

function renderResourcesPage(resources, classrooms, students) {
  const rowsHtml = resources.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.title || 'Untitled')}</strong></td>
      <td>${escapeHtml(item.type || 'File')}</td>
      <td>${escapeHtml(item.classroomName || '—')}</td>
      <td>${escapeHtml(item.studentName || '—')}</td>
      <td>${item.fileUrl ? renderFilePreview(item.fileUrl, item.fileName) : '—'}</td>
      <td>${fmtDate(item.createdAt)}</td><td><button class="btn danger resource-delete-btn" data-id="${escapeHtml(item.id)}">Delete</button></td>
    </tr>
    <tr class="details-row"><td colspan="7"><div style="padding:14px;background:var(--surface-2);border-radius:12px;"><strong>Description:</strong> ${escapeHtml(item.note || 'No description')}<br>${item.fileName ? `<strong>File:</strong> ${escapeHtml(item.fileName)}` : ''}</div></td></tr>
  `).join('');

  return `
    <section class="card panel"><h3>📚 Upload New Resource</h3><form id="resourceForm" class="stack-form"><div class="form-row"><label>Title *</label><input id="resourceTitle" required></div><div class="form-row"><label>Type</label><input id="resourceType"></div><div class="form-row"><label>Classroom</label><select id="resourceClassroomId"><option value="">None</option>${classrooms.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="form-row"><label>Student</label><select id="resourceStudentId"><option value="">None</option>${students.map(s => `<option value="${s.id}">${s.full_name || s.email}</option>`).join('')}</select></div><div class="form-row"><label>File</label><input id="resourceFile" type="file"></div><div class="form-row"><label>Description</label><textarea id="resourceNote"></textarea></div><button class="btn" id="saveResourceBtn">Upload</button><span id="resourceMsg"></span></form></section>
    <section class="card panel" style="margin-top:20px"><h3>Resources (${resources.length})</h3>${simpleTable(['Title', 'Type', 'Classroom', 'Student', 'File', 'Created', 'Action'], rowsHtml)}</section>
  `;
}

function renderParentDashboard(children, assignmentsByChild, assessmentsByChild, attendanceByChild, alerts) {
  const totalChildren = children.length;
  const totalAssignments = Object.values(assignmentsByChild).flat().length;
  const pendingAssignments = Object.values(assignmentsByChild).flat().filter(a => a.status !== 'Submitted' && a.status !== 'Completed').length;
  const totalAssessments = Object.values(assessmentsByChild).flat().length;
  const recentAlerts = alerts.filter(a => !a.acknowledged).slice(0, 5);
  
  // Calculate subject performance summary
  const subjectPerformance = {};
  Object.values(assessmentsByChild).flat().forEach(a => {
    if (a.subject && a.score && a.maxScore) {
      if (!subjectPerformance[a.subject]) {
        subjectPerformance[a.subject] = { total: 0, count: 0 };
      }
      subjectPerformance[a.subject].total += (a.score / a.maxScore) * 100;
      subjectPerformance[a.subject].count++;
    }
  });
  
  const subjectsHtml = Object.entries(subjectPerformance).map(([subject, data]) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between">
        <strong>${escapeHtml(subject)}</strong>
        <span>${Math.round(data.total / data.count)}%</span>
      </div>
      <div class="progress-bar"><div style="width:${data.total / data.count}%;background:#3498db;height:8px;border-radius:4px"></div></div>
    </div>
  `).join('');
  
  // Areas of concern (assignments overdue, low scores)
  const areasOfConcern = [];
  Object.entries(assignmentsByChild).forEach(([childId, assignments]) => {
    const child = children.find(c => c.id === childId);
    const overdue = assignments.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'Submitted');
    if (overdue.length > 0) {
      areasOfConcern.push(`${child?.full_name || child?.name}: ${overdue.length} overdue assignment(s)`);
    }
  });
  
  Object.entries(assessmentsByChild).forEach(([childId, assessments]) => {
    const child = children.find(c => c.id === childId);
    const lowScores = assessments.filter(a => a.score && a.maxScore && (a.score / a.maxScore) < 0.7);
    if (lowScores.length > 0) {
      areasOfConcern.push(`${child?.full_name || child?.name}: ${lowScores.length} assessment(s) below 70%`);
    }
  });
  
  return `
    <style>
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px; }
      .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .stat-number { font-size: 32px; font-weight: bold; margin: 0; color: #2c3e50; }
      .dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
      @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
      .alert-item { padding: 12px; border-left: 3px solid #e74c3c; background: #fff5f5; margin-bottom: 8px; border-radius: 8px; }
      .concern-item { padding: 8px 12px; background: #fff3e0; border-radius: 8px; margin-bottom: 8px; }
      .progress-bar { background: #ecf0f1; border-radius: 4px; overflow: hidden; }
      .child-card { background: #f8f9fa; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    </style>
    
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${totalChildren}</div><p>Children</p></div>
      <div class="stat-card"><div class="stat-number">${totalAssignments}</div><p>Total Assignments</p></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingAssignments}</div><p>Pending</p></div>
      <div class="stat-card"><div class="stat-number">${totalAssessments}</div><p>Assessments Completed</p></div>
    </div>
    
    <div class="dashboard-grid">
      <div class="card panel">
        <h3>⚠️ Areas of Concern</h3>
        ${areasOfConcern.length ? areasOfConcern.map(c => `<div class="concern-item">⚠️ ${escapeHtml(c)}</div>`).join('') : '<p class="empty">No major concerns - great job!</p>'}
      </div>
      
      <div class="card panel">
        <h3>📊 Subject Performance Overview</h3>
        ${subjectsHtml || '<p class="empty">No assessment data yet</p>'}
      </div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>🔔 Recent Alerts & Notifications</h3>
      ${recentAlerts.length ? recentAlerts.map(a => `<div class="alert-item"><strong>${escapeHtml(a.title)}</strong><br><small>${escapeHtml(a.message)}</small><br><small class="text-muted">${fmtDate(a.createdAt)}</small></div>`).join('') : '<p class="empty">No new alerts</p>'}
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>👧👦 Children at a Glance</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${children.map(child => {
          const childAssignments = assignmentsByChild[child.id] || [];
          const completedAssignments = childAssignments.filter(a => a.status === 'Submitted' || a.status === 'Completed').length;
          const childAssessments = assessmentsByChild[child.id] || [];
          const avgScore = childAssessments.filter(a => a.score && a.maxScore).reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) / (childAssessments.filter(a => a.score && a.maxScore).length || 1);
          
          return `
            <div class="child-card">
              <h4>${escapeHtml(child.full_name || child.name)}</h4>
              <p>Grade: ${escapeHtml(child.grade_level || '—')} | Classroom: ${escapeHtml(child.classroomName || '—')}</p>
              <div style="display:flex;justify-content:space-between;margin-top:12px;">
                <span>📝 ${completedAssignments}/${childAssignments.length} done</span>
                <span>📊 ${Math.round(avgScore)}% avg</span>
              </div>
              <div style="margin-top:12px;">
                <button class="btn small ghost" onclick="location.href='/parent/portfolio.html?childId=${child.id}'">View Portfolio →</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderParentAssessmentsPage(children, assessmentsByChild) {
  const allAssessments = [];
  children.forEach(child => {
    const childAssessments = assessmentsByChild[child.id] || [];
    childAssessments.forEach(a => {
      allAssessments.push({
        ...a,
        childName: child.full_name || child.name,
        childId: child.id,
        percentage: a.score && a.maxScore ? Math.round((a.score / a.maxScore) * 100) : null
      });
    });
  });
  
  allAssessments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
  const rows = allAssessments.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.childName)}</strong></td>
      <td><strong>${escapeHtml(a.title)}</strong></td>
      <td>${escapeHtml(a.subject || '—')}</td>
      <td>${a.score || '—'} / ${a.maxScore || '—'}</td>
      <td>${a.percentage ? a.percentage + '%' : '—'}</td>
      <td>${statusBadge(a.status || 'Pending')}</td>
      <td>${fmtDate(a.createdAt)}</td>
      <td>${a.feedback ? `<button class="btn small ghost view-feedback-btn" data-feedback="${escapeHtml(a.feedback)}">View Feedback</button>` : '—'}</td>
    </tr>
  `).join('');
  
  return `<div class="card panel"><h3>📊 All Assessments by Child</h3>${simpleTable(['Child', 'Assessment', 'Subject', 'Score', 'Percentage', 'Status', 'Date', 'Feedback'], rows)}</div>`;
}



function renderParentAssignmentsPage(children, assignmentsByChild, submissionsByChild) {
  const allAssignments = [];
  children.forEach(child => {
    const childAssignments = assignmentsByChild[child.id] || [];
    childAssignments.forEach(a => {
      const submission = submissionsByChild[child.id]?.find(s => s.assignmentId === a.id);
      allAssignments.push({
        ...a,
        childName: child.full_name || child.name,
        childId: child.id,
        submitted: !!submission,
        submittedAt: submission?.submittedAt,
        fileUrl: submission?.fileUrl
      });
    });
  });
  
  allAssignments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
  const rows = allAssignments.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.childName)}</strong></td>
      <td><strong>${escapeHtml(a.title)}</strong></td>
      <td>${escapeHtml(a.subject || '—')}</td>
      <td>${fmtDate(a.dueDate)}</td>
      <td>${a.submitted ? statusBadge('Submitted') : statusBadge('Pending')}</td>
      <td>${a.submitted ? fmtDate(a.submittedAt) : '—'}</td>
      <td>${a.fileUrl ? `<a href="${a.fileUrl}" target="_blank" class="btn small ghost">View</a>` : (a.submitted ? '✓' : '—')}</td>
    </tr>
  `).join('');
  
  const pendingCount = allAssignments.filter(a => !a.submitted).length;
  const completedCount = allAssignments.filter(a => a.submitted).length;
  
  return `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-number">${allAssignments.length}</div><p>Total Assignments</p></div>
      <div class="stat-card" style="background:#e8f5e9;"><div class="stat-number">${completedCount}</div><p>Completed</p></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingCount}</div><p>Pending</p></div>
    </div>
    <div class="card panel"><h3>📝 All Assignments by Child</h3>${simpleTable(['Child', 'Assignment', 'Subject', 'Due Date', 'Status', 'Submitted', 'File'], rows)}</div>
  `;
}


function renderParentAttendancePage(children, attendanceByChild) {
  const allRecords = [];
  children.forEach(child => {
    const records = attendanceByChild[child.id] || [];
    records.forEach(r => {
      allRecords.push({
        ...r,
        childName: child.full_name || child.name,
        childId: child.id
      });
    });
  });
  
  allRecords.sort((a, b) => {
    const aDate = toMillis(a.recordDate || a.date || a.attendanceDate);
    const bDate = toMillis(b.recordDate || b.date || b.attendanceDate);
    return bDate - aDate;
  });
  
  const summary = {};
  children.forEach(child => {
    const records = attendanceByChild[child.id] || [];
    summary[child.id] = {
      name: child.full_name || child.name,
      present: records.filter(r => sentenceCase(r.status) === 'Present').length,
      absent: records.filter(r => sentenceCase(r.status) === 'Absent').length,
      late: records.filter(r => sentenceCase(r.status) === 'Late').length,
      total: records.length
    };
  });
  
  const summaryRows = Object.values(summary).map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${s.present}</td>
      <td>${s.absent}</td>
      <td>${s.late}</td>
      <td>${s.total}</td>
      <td>${s.total ? Math.round((s.present / s.total) * 100) : 0}%</td>
    </tr>
  `).join('');
  
  const detailRows = allRecords.map(r => `
    <tr>
      <td>${escapeHtml(r.childName)}</td>
      <td>${fmtDate(r.recordDate || r.date || r.attendanceDate)}</td>
      <td>${statusBadge(sentenceCase(r.status))}</td>
      <td>${escapeHtml(r.classroomName || r.classroom || '—')}</td>
      <td>${escapeHtml(r.tutorName || r.recordedBy || '—')}</td>
      <td>${escapeHtml(r.note || r.notes || '—')}</td>
    </tr>
  `).join('');
  
  return `
    <div class="card panel">
      <h3>📅 Attendance Summary by Child</h3>
      ${simpleTable(['Child', 'Present', 'Absent', 'Late', 'Total Days', 'Attendance Rate'], summaryRows)}
    </div>
    <div class="card panel" style="margin-top:24px;">
      <h3>📋 Detailed Attendance Records</h3>
      ${simpleTable(['Child', 'Date', 'Status', 'Classroom', 'Recorded By', 'Notes'], detailRows)}
    </div>
  `;
}

function renderParentReportsPage(children, reportsByChild) {
  const allReports = [];
  children.forEach(child => {
    const reports = reportsByChild[child.id] || [];
    reports.forEach(r => {
      allReports.push({
        ...r,
        childName: child.full_name || child.name,
        childId: child.id
      });
    });
  });
  
  allReports.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
  const reportCards = allReports.map(r => `
    <div class="card panel" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
        <h4>${escapeHtml(r.childName)} - ${escapeHtml(r.title || 'Progress Report')}</h4>
        <small>${fmtDate(r.createdAt)}</small>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0;">
        <div style="background:#e8f5e9;padding:12px;border-radius:8px;">
          <strong>✅ Strengths</strong>
          <p>${escapeHtml(r.strengths || '—')}</p>
        </div>
        <div style="background:#fff3e0;padding:12px;border-radius:8px;">
          <strong>⚠️ Areas for Improvement</strong>
          <p>${escapeHtml(r.lows || r.challenges || '—')}</p>
        </div>
      </div>
      <div style="background:#f0f7ff;padding:12px;border-radius:8px;">
        <strong>📝 Summary</strong>
        <p>${escapeHtml(r.summary || r.comment || '—')}</p>
      </div>
      ${r.recommendations ? `<div style="margin-top:12px;"><strong>💡 Recommendations:</strong> ${escapeHtml(r.recommendations)}</div>` : ''}
    </div>
  `).join('');
  
  return `<div class="card panel"><h3>📄 Academic Reports by Child</h3>${allReports.length ? reportCards : '<p class="empty">No reports available yet</p>'}</div>`;
}

function renderParentResourcesPage(children, resourcesByChild) {
  const allResources = [];
  children.forEach(child => {
    const resources = resourcesByChild[child.id] || [];
    resources.forEach(r => {
      allResources.push({
        ...r,
        childName: child.full_name || child.name,
        childId: child.id
      });
    });
  });
  
  allResources.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
  const resourceCards = allResources.map(r => `
    <div class="card panel" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
        <div>
          <span class="badge">${escapeHtml(r.childName)}</span>
          <strong style="margin-left:8px;">${escapeHtml(r.title)}</strong>
        </div>
        <small>${fmtDate(r.createdAt)}</small>
      </div>
      ${r.note ? `<p style="margin:12px 0;">${escapeHtml(r.note)}</p>` : ''}
      ${r.fileUrl ? renderFilePreview(r.fileUrl, r.fileName) : ''}
      <div style="margin-top:8px;">
        <small>Type: ${escapeHtml(r.type || 'Resource')} | Subject: ${escapeHtml(r.subject || 'General')}</small>
      </div>
    </div>
  `).join('');
  
  return `<div class="card panel"><h3>📚 Learning Resources by Child</h3>${allResources.length ? resourceCards : '<p class="empty">No resources shared yet</p>'}</div>`;
}

function renderParentMessagesPage(children, messages) {
  const sentMessages = messages.filter(m => m.direction === 'sent' || m.fromParent);
  const receivedMessages = messages.filter(m => m.direction === 'received' || m.toParent);
  
  const receivedHtml = receivedMessages.map(m => `
    <div class="card panel" style="margin-bottom:12px;border-left:3px solid #3498db;">
      <div style="display:flex;justify-content:space-between;">
        <strong>From: ${escapeHtml(m.fromName || m.tutorName || 'Tutor')}</strong>
        <small>${fmtDate(m.createdAt)}</small>
      </div>
      <strong>${escapeHtml(m.subject || 'Message')}</strong>
      <p>${escapeHtml(m.message || m.body || '—')}</p>
      ${m.replied ? '<span class="badge success">Replied</span>' : ''}
    </div>
  `).join('');
  
  const sentHtml = sentMessages.map(m => `
    <div class="card panel" style="margin-bottom:12px;border-left:3px solid #95a5a6;">
      <div style="display:flex;justify-content:space-between;">
        <strong>To: ${escapeHtml(m.toName || m.studentName || 'Tutor')}</strong>
        <small>${fmtDate(m.createdAt)}</small>
      </div>
      <strong>${escapeHtml(m.subject || 'Message')}</strong>
      <p>${escapeHtml(m.message || m.body || '—')}</p>
    </div>
  `).join('');
  
  const studentOptions = children.map(c => `<option value="${c.id}">${escapeHtml(c.full_name || c.name)} (child)</option>`).join('');
  
  return `
    <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div class="card panel">
        <h3>✉️ Send Message</h3>
        <form id="parentMessageForm" class="stack-form">
          <div class="form-row">
            <label>To</label>
            <select id="messageRecipientId" required>
              <option value="">-- Select Recipient --</option>
              <option value="tutor">📚 Tutor/Teacher</option>
              ${studentOptions}
            </select>
          </div>
          <div class="form-row">
            <label>Subject</label>
            <input id="messageSubject" type="text" required placeholder="Message subject...">
          </div>
          <div class="form-row">
            <label>Message</label>
            <textarea id="messageBody" rows="5" required placeholder="Write your message here..."></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn">Send Message</button>
            <span id="messageMsg"></span>
          </div>
        </form>
      </div>
      
      <div>
        <div class="card panel">
          <h3>📥 Received Messages</h3>
          ${receivedHtml || '<p class="empty">No messages yet</p>'}
        </div>
        <div class="card panel" style="margin-top:20px;">
          <h3>📤 Sent Messages</h3>
          ${sentHtml || '<p class="empty">No sent messages</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderParentSettingsPage(profile, children) {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div class="card panel">
        <h3>👤 Profile Information</h3>
        <div style="padding:16px 0;">
          <div style="margin-bottom:16px;"><strong>Name:</strong> ${escapeHtml(profile?.name || profile?.full_name || '—')}</div>
          <div style="margin-bottom:16px;"><strong>Email:</strong> ${escapeHtml(profile?.email || '—')}</div>
          <div style="margin-bottom:16px;"><strong>Role:</strong> ${escapeHtml(profile?.role || 'Parent')}</div>
          <div><strong>Account Created:</strong> ${fmtDate(profile?.createdAt)}</div>
        </div>
      </div>
      
      <div class="card panel">
        <h3>👨‍👩‍👧‍👦 Linked Children</h3>
        ${children.length ? children.map(c => `
          <div style="padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
            <div><strong>${escapeHtml(c.full_name || c.name)}</strong><br><small>Grade ${escapeHtml(c.grade_level || '—')}</small></div>
            <span class="badge success">Linked</span>
          </div>
        `).join('') : '<p class="empty">No children linked. Contact your tutor to connect accounts.</p>'}
      </div>
      
      <div class="card panel">
        <h3>🔔 Notification Preferences</h3>
        <form id="notificationPrefsForm">
          <div style="margin-bottom:12px;"><label><input type="checkbox" id="notifyAssignments" checked> Assignment reminders</label></div>
          <div style="margin-bottom:12px;"><label><input type="checkbox" id="notifyAssessments" checked> Assessment results</label></div>
          <div style="margin-bottom:12px;"><label><input type="checkbox" id="notifyAttendance" checked> Attendance updates</label></div>
          <div style="margin-bottom:12px;"><label><input type="checkbox" id="notifyMessages" checked> New messages</label></div>
          <button type="submit" class="btn small">Save Preferences</button>
          <span id="prefMsg"></span>
        </form>
      </div>
      
      <div class="card panel">
        <h3>🔒 Security</h3>
        <button class="btn ghost" id="changePasswordBtn">Change Password</button>
        <button class="btn danger" id="logoutSettingsBtn" style="margin-left:12px;">Logout</button>
      </div>
    </div>
  `;
}

function renderParentGrowthPage(children, growthNotesByChild) {
  const allNotes = [];
  children.forEach(child => {
    const notes = growthNotesByChild[child.id] || [];
    notes.forEach(n => {
      allNotes.push({
        ...n,
        childName: child.full_name || child.name,
        childId: child.id
      });
    });
  });
  
  allNotes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
  const noteCards = allNotes.map(n => `
    <div class="card panel" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <span class="badge ${n.type === 'Strength' ? 'success' : (n.type === 'Challenge' ? 'danger' : 'warn')}">${escapeHtml(n.type || 'Note')}</span>
        <small>${escapeHtml(n.childName)} • ${fmtDate(n.createdAt)}</small>
      </div>
      <p style="margin-top:12px;">${escapeHtml(n.note || n.comment || '—')}</p>
      ${n.milestone ? `<small>🎯 Milestone: ${escapeHtml(n.milestone)}</small>` : ''}
    </div>
  `).join('');
  
  return `
    <div class="card panel">
      <h3>🌱 Growth & Development Notes</h3>
      <p>Track social-emotional growth, behavioral observations, and developmental milestones across all children.</p>
      ${allNotes.length ? noteCards : '<p class="empty">No growth notes recorded yet</p>'}
    </div>
  `;
}



async function bootParentSuperDashboard() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const { user, profile } = bundle;
  
  // Load ALL data from the entire system
  const [allStudents, allTutors, allAssignments, allAssessments, allSubmissions, allAttendance, allResources, allPortfolios, allReports, allMessages] = await Promise.all([
    loadAllUsersByRole('student'),
    loadAllUsersByRole('tutor'),
    loadAllAssignments(),
    loadAllAssessments(),
    loadAllSubmissions(),
    loadAllAttendance(),
    loadAllResources(),
    loadAllPortfolios(),
    loadAllReports(),
    loadAllMessages()
  ]);
  
  // Calculate stats
  const totalStudents = allStudents.length;
  const totalTutors = allTutors.length;
  const totalAssignments = allAssignments.length;
  const totalAssessments = allAssessments.length;
  const pendingAssignments = allAssignments.filter(a => a.status !== 'Submitted' && a.status !== 'Completed').length;
  const pendingAssessments = allAssessments.filter(a => a.status !== 'Graded').length;
  
  // Calculate subject performance across all students
  const subjectPerformance = {};
  allAssessments.forEach(a => {
    if (a.subject && a.score && a.maxScore) {
      if (!subjectPerformance[a.subject]) {
        subjectPerformance[a.subject] = { total: 0, count: 0 };
      }
      subjectPerformance[a.subject].total += (a.score / a.maxScore) * 100;
      subjectPerformance[a.subject].count++;
    }
  });
  
  const subjectsHtml = Object.entries(subjectPerformance).map(([subject, data]) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between">
        <strong>${escapeHtml(subject)}</strong>
        <span>${Math.round(data.total / data.count)}%</span>
      </div>
      <div class="progress-bar"><div style="width:${data.total / data.count}%;background:#3498db;height:8px;border-radius:4px"></div></div>
    </div>
  `).join('');
  
  // Recent activity feed
  const recentActivities = [
    ...allAssignments.slice(0, 5).map(a => ({ type: 'Assignment', title: a.title, date: a.createdAt, studentName: a.studentName })),
    ...allAssessments.slice(0, 5).map(a => ({ type: 'Assessment', title: a.title, date: a.createdAt, studentName: a.studentName })),
    ...allSubmissions.slice(0, 5).map(s => ({ type: 'Submission', title: s.assignmentTitle, date: s.submittedAt, studentName: s.studentName }))
  ].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)).slice(0, 10);
  
  const activityHtml = recentActivities.map(a => `
    <div style="padding:10px;border-bottom:1px solid #eee;">
      <span class="badge">${escapeHtml(a.type)}</span>
      <strong>${escapeHtml(a.title)}</strong> - ${escapeHtml(a.studentName || '—')}
      <small style="float:right">${fmtDate(a.date)}</small>
    </div>
  `).join('');
  
  document.getElementById('page-content').innerHTML = `
    <style>
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 24px; }
      .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .stat-number { font-size: 32px; font-weight: bold; margin: 0; color: #2c3e50; }
      .dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
      @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
      .progress-bar { background: #ecf0f1; border-radius: 4px; overflow: hidden; }
    </style>
    
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${totalStudents}</div><p>Students</p></div>
      <div class="stat-card"><div class="stat-number">${totalTutors}</div><p>Tutors</p></div>
      <div class="stat-card"><div class="stat-number">${totalAssignments}</div><p>Assignments</p></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingAssignments}</div><p>Pending</p></div>
      <div class="stat-card"><div class="stat-number">${totalAssessments}</div><p>Assessments</p></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingAssessments}</div><p>Un-graded</p></div>
    </div>
    
    <div class="dashboard-grid">
      <div class="card panel">
        <h3>📊 System-Wide Performance</h3>
        ${subjectsHtml || '<p class="empty">No assessment data yet</p>'}
      </div>
      <div class="card panel">
        <h3>🔄 Recent Activity Feed</h3>
        ${activityHtml || '<p class="empty">No recent activity</p>'}
      </div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>👥 All Students</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
        ${allStudents.map(s => `
          <div style="padding:12px;background:#f8f9fa;border-radius:8px;">
            <strong>${escapeHtml(s.full_name || s.name || s.email)}</strong>
            <br><small>Classroom: ${escapeHtml(s.classroomName || 'Not assigned')}</small>
            <br><small>Email: ${escapeHtml(s.email || '—')}</small>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>👨‍🏫 All Tutors</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
        ${allTutors.map(t => `
          <div style="padding:12px;background:#f8f9fa;border-radius:8px;">
            <strong>${escapeHtml(t.full_name || t.name || t.email)}</strong>
            <br><small>Email: ${escapeHtml(t.email || '—')}</small>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function bootParentAllStudentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const allStudents = await loadAllUsersByRole('student');
  const allTutors = await loadAllUsersByRole('tutor');
  const allClassrooms = await loadAllClassrooms();
  const allNotes = await loadAllStudentNotes();
  
  // Group notes by student
  const notesByStudent = {};
  allNotes.forEach(note => {
    if (!notesByStudent[note.studentId]) notesByStudent[note.studentId] = [];
    notesByStudent[note.studentId].push(note);
  });
  
  const studentsHtml = allStudents.map(student => {
    const studentNotes = notesByStudent[student.id] || [];
    const latestNote = studentNotes[0]?.comment || 'No comments yet';
    const classroom = allClassrooms.find(c => c.id === student.classroomId);
    
    return `
      <div class="student-card" style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0">${escapeHtml(student.full_name || student.name || student.email)}</h3>
            <p style="margin:4px 0;color:#666;">${escapeHtml(student.email || '—')}</p>
          </div>
          <div>
            <span class="badge ${classroom ? 'success' : 'warn'}">${escapeHtml(classroom?.name || student.classroomName || 'Not assigned')}</span>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:20px;flex-wrap:wrap;">
          <span>📚 Grade: ${escapeHtml(student.grade_level || '—')}</span>
          <span>📝 Comments: ${studentNotes.length}</span>
        </div>
        <div style="margin-top:12px;background:#f8f9fa;padding:12px;border-radius:8px;">
          <strong>Latest comment:</strong><br>${escapeHtml(latestNote)}
        </div>
        <div style="margin-top:12px;">
          <button class="btn small ghost view-student-details" data-id="${student.id}" data-name="${escapeHtml(student.full_name || student.name)}">View Full Details →</button>
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-number">${allStudents.length}</div><p>Total Students</p></div>
      <div class="stat-card"><div class="stat-number">${allTutors.length}</div><p>Total Tutors</p></div>
      <div class="stat-card"><div class="stat-number">${allClassrooms.length}</div><p>Classrooms</p></div>
      <div class="stat-card"><div class="stat-number">${allNotes.length}</div><p>Total Comments</p></div>
    </div>
    <div class="card panel">
      <h3>👥 All Students in System</h3>
      <p>Complete list of all registered students across all classrooms and tutors.</p>
      ${studentsHtml || '<p class="empty">No students registered yet</p>'}
    </div>
  `;
}

async function bootParentAllAssignmentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allAssignments, allSubmissions, allStudents] = await Promise.all([
    loadAllAssignments(),
    loadAllSubmissions(),
    loadAllUsersByRole('student')
  ]);
  
  // Map submissions by assignmentId
  const submissionsByAssignment = {};
  allSubmissions.forEach(sub => {
    if (!submissionsByAssignment[sub.assignmentId]) submissionsByAssignment[sub.assignmentId] = [];
    submissionsByAssignment[sub.assignmentId].push(sub);
  });
  
  // Map student names
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s.full_name || s.name || s.email; });
  
  const rows = allAssignments.map(a => {
    const submissions = submissionsByAssignment[a.id] || [];
    const submittedCount = submissions.length;
    const studentName = a.studentName || studentMap[a.studentId] || (a.targetType === 'all_students' ? 'All Students' : a.classroomName || '—');
    
    return `
      <div class="card panel" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
          <div>
            <h4>${escapeHtml(a.title)}</h4>
            <p><strong>Target:</strong> ${escapeHtml(studentName)}</p>
          </div>
          <div>
            <span class="badge ${a.status === 'Active' ? 'success' : 'warn'}">${escapeHtml(a.status || 'Active')}</span>
            <small style="display:block;">Due: ${fmtDate(a.dueDate)}</small>
          </div>
        </div>
        <p>${escapeHtml(a.description || 'No description')}</p>
        <div style="margin-top:12px;background:#f8f9fa;padding:12px;border-radius:8px;">
          <strong>📋 Submissions (${submittedCount}):</strong>
          ${submissions.length ? submissions.map(s => `
            <div style="padding:8px;border-bottom:1px solid #eee;">
              ${escapeHtml(s.studentName)} - ${fmtDate(s.submittedAt)}
              ${s.fileUrl ? `<a href="${s.fileUrl}" target="_blank" class="btn small ghost">View File</a>` : ''}
            </div>
          `).join('') : '<p class="empty" style="margin:8px 0 0;">No submissions yet</p>'}
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-number">${allAssignments.length}</div><p>Total Assignments</p></div>
      <div class="stat-card"><div class="stat-number">${allSubmissions.length}</div><p>Total Submissions</p></div>
      <div class="stat-card"><div class="stat-number">${allAssignments.filter(a => a.status !== 'Submitted').length}</div><p>Pending</p></div>
    </div>
    <div class="card panel">
      <h3>📝 All Assignments in System</h3>
      ${rows || '<p class="empty">No assignments created yet</p>'}
    </div>
  `;
}

async function bootParentAllAssessmentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allAssessments, allStudents] = await Promise.all([
    loadAllAssessments(),
    loadAllUsersByRole('student')
  ]);
  
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s.full_name || s.name || s.email; });
  
  const rows = allAssessments.map(a => `
    <div class="card panel" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4>${escapeHtml(a.title)}</h4>
          <p><strong>Student:</strong> ${escapeHtml(a.studentName || studentMap[a.studentId] || '—')}</p>
          <p><strong>Subject:</strong> ${escapeHtml(a.subject || '—')}</p>
        </div>
        <div style="text-align:right;">
          <span class="badge ${a.status === 'Graded' ? 'success' : 'warn'}">${escapeHtml(a.status || 'Pending')}</span>
          ${a.score ? `<div><strong>Score:</strong> ${a.score}/${a.maxScore || '—'} (${Math.round((a.score/(a.maxScore||1))*100)}%)</div>` : ''}
          <small>${fmtDate(a.createdAt)}</small>
        </div>
      </div>
      ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ''}
      ${a.feedback ? `<div style="margin-top:12px;background:#f0f7ff;padding:12px;border-radius:8px;"><strong>📝 Feedback:</strong> ${escapeHtml(a.feedback)}</div>` : ''}
    </div>
  `).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-number">${allAssessments.length}</div><p>Total Assessments</p></div>
      <div class="stat-card"><div class="stat-number">${allAssessments.filter(a => a.status === 'Graded').length}</div><p>Graded</p></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${allAssessments.filter(a => a.status !== 'Graded').length}</div><p>Pending Grading</p></div>
    </div>
    <div class="card panel">
      <h3>📊 All Assessments in System</h3>
      ${rows || '<p class="empty">No assessments created yet</p>'}
    </div>
  `;
}

async function bootParentAllAttendancePage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allAttendance, allStudents] = await Promise.all([
    loadAllAttendance(),
    loadAllUsersByRole('student')
  ]);
  
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s.full_name || s.name || s.email; });
  
  // Group by student for summary
  const summaryByStudent = {};
  allAttendance.forEach(record => {
    const studentId = record.studentId;
    if (!summaryByStudent[studentId]) {
      summaryByStudent[studentId] = { present: 0, absent: 0, late: 0, total: 0 };
    }
    const status = sentenceCase(record.status);
    if (status === 'Present') summaryByStudent[studentId].present++;
    else if (status === 'Absent') summaryByStudent[studentId].absent++;
    else if (status === 'Late') summaryByStudent[studentId].late++;
    summaryByStudent[studentId].total++;
  });
  
  const summaryRows = Object.entries(summaryByStudent).map(([studentId, stats]) => `
    <tr>
      <td>${escapeHtml(studentMap[studentId] || studentId)}</td>
      <td>${stats.present}</td>
      <td>${stats.absent}</td>
      <td>${stats.late}</td>
      <td>${stats.total}</td>
      <td>${stats.total ? Math.round((stats.present / stats.total) * 100) : 0}%</td>
    </tr>
  `).join('');
  
  const detailRows = allAttendance.sort((a,b) => {
    const aDate = toMillis(a.recordDate || a.date || a.attendanceDate);
    const bDate = toMillis(b.recordDate || b.date || b.attendanceDate);
    return bDate - aDate;
  }).map(record => `
    <tr>
      <td>${escapeHtml(studentMap[record.studentId] || record.studentId)}</td>
      <td>${fmtDate(record.recordDate || record.date || record.attendanceDate)}</td>
      <td>${statusBadge(sentenceCase(record.status))}</td>
      <td>${escapeHtml(record.classroomName || record.classroom || '—')}</td>
      <td>${escapeHtml(record.tutorName || record.recordedBy || '—')}</td>
    </tr>
  `).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="card panel">
      <h3>📅 Attendance Summary by Student</h3>
      ${simpleTable(['Student', 'Present', 'Absent', 'Late', 'Total Days', 'Rate'], summaryRows)}
    </div>
    <div class="card panel" style="margin-top:24px;">
      <h3>📋 Detailed Attendance Records</h3>
      ${simpleTable(['Student', 'Date', 'Status', 'Classroom', 'Recorded By'], detailRows)}
    </div>
  `;
}

async function bootParentAllResourcesPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allResources, allStudents, allTutors] = await Promise.all([
    loadAllResources(),
    loadAllUsersByRole('student'),
    loadAllUsersByRole('tutor')
  ]);
  
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s.full_name || s.name || s.email; });
  
  const tutorMap = {};
  allTutors.forEach(t => { tutorMap[t.id] = t.full_name || t.name || t.email; });
  
  const resourceCards = allResources.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(r => `
    <div class="card panel" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
        <div>
          <h4>${escapeHtml(r.title)}</h4>
          <p><strong>Shared by:</strong> ${escapeHtml(tutorMap[r.tutorId] || r.tutorName || 'Tutor')}</p>
        </div>
        <small>${fmtDate(r.createdAt)}</small>
      </div>
      ${r.note ? `<p>${escapeHtml(r.note)}</p>` : ''}
      <div style="margin-top:8px;">
        <span class="badge">${escapeHtml(r.type || 'Resource')}</span>
        ${r.classroomName ? `<span class="badge">📚 ${escapeHtml(r.classroomName)}</span>` : ''}
        ${r.studentName ? `<span class="badge">👤 ${escapeHtml(r.studentName)}</span>` : ''}
      </div>
      ${r.fileUrl ? renderFilePreview(r.fileUrl, r.fileName) : ''}
    </div>
  `).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-number">${allResources.length}</div><p>Total Resources</p></div>
      <div class="stat-card"><div class="stat-number">${allResources.filter(r => r.fileUrl).length}</div><p>With Attachments</p></div>
    </div>
    <div class="card panel">
      <h3>📚 All Learning Resources</h3>
      ${resourceCards || '<p class="empty">No resources uploaded yet</p>'}
    </div>
  `;
}

async function bootParentAllMessagesPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allMessages, allStudents, allTutors] = await Promise.all([
    loadAllMessages(),
    loadAllUsersByRole('student'),
    loadAllUsersByRole('tutor')
  ]);
  
  const userMap = {};
  allStudents.forEach(s => { userMap[s.id] = { name: s.full_name || s.name || s.email, role: 'Student' }; });
  allTutors.forEach(t => { userMap[t.id] = { name: t.full_name || t.name || t.email, role: 'Tutor' }; });
  
  const messagesByConversation = {};
  allMessages.forEach(msg => {
    const participants = [msg.fromId, msg.toId].sort().join('-');
    if (!messagesByConversation[participants]) messagesByConversation[participants] = [];
    messagesByConversation[participants].push(msg);
  });
  
  const conversationHtml = Object.values(messagesByConversation).map(conversation => {
    const sorted = conversation.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    const first = sorted[0];
    const fromName = userMap[first.fromId]?.name || first.fromName || first.fromId;
    const toName = userMap[first.toId]?.name || first.toName || first.toId;
    
    return `
      <div class="card panel" style="margin-bottom:16px;">
        <div style="border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px;">
          <strong>💬 ${escapeHtml(fromName)} → ${escapeHtml(toName)}</strong>
          <small style="float:right">${sorted.length} messages</small>
        </div>
        ${sorted.slice(-3).map(msg => `
          <div style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
            <div style="display:flex;justify-content:space-between;">
              <strong>${escapeHtml(msg.subject || 'Message')}</strong>
              <small>${fmtDate(msg.createdAt)}</small>
            </div>
            <p style="margin:4px 0 0;font-size:13px;">${escapeHtml(msg.message || msg.body || '—')}</p>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-number">${allMessages.length}</div><p>Total Messages</p></div>
      <div class="stat-card"><div class="stat-number">${Object.keys(messagesByConversation).length}</div><p>Conversations</p></div>
    </div>
    <div class="card panel">
      <h3>📨 All Conversations</h3>
      ${conversationHtml || '<p class="empty">No messages yet</p>'}
    </div>
    <div class="card panel" style="margin-top:24px;">
      <h3>✉️ Send New Message</h3>
      <form id="parentMessageForm" class="stack-form">
        <div class="form-row">
          <label>To (User ID or Email)</label>
          <input type="text" id="messageToId" placeholder="Enter user ID or email" required>
        </div>
        <div class="form-row">
          <label>Subject</label>
          <input id="messageSubject" type="text" required placeholder="Subject">
        </div>
        <div class="form-row">
          <label>Message</label>
          <textarea id="messageBody" rows="4" required placeholder="Write your message..."></textarea>
        </div>
        <button type="submit" class="btn">Send Message</button>
        <span id="messageMsg"></span>
      </form>
    </div>
  `;
  
  const form = document.getElementById('parentMessageForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const toId = document.getElementById('messageToId').value;
      const subject = document.getElementById('messageSubject').value;
      const body = document.getElementById('messageBody').value;
      const msgSpan = document.getElementById('messageMsg');
      
      if (!toId || !subject || !body) {
        msgSpan.textContent = 'Please fill all fields';
        return;
      }
      
      msgSpan.textContent = 'Sending...';
      
      try {
        await addDoc(collection(db, 'messages'), {
          fromParent: true,
          fromId: bundle.user.uid,
          fromName: bundle.profile?.name || bundle.profile?.full_name,
          toId: toId,
          subject: subject,
          message: body,
          createdAt: serverTimestamp(),
          read: false
        });
        
        msgSpan.textContent = '✅ Message sent!';
        form.reset();
        setTimeout(() => bootParentAllMessagesPage(), 1500);
      } catch (err) {
        msgSpan.textContent = 'Error: ' + err.message;
      }
    });
  }
}

async function bootParentAllReportsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allReports, allStudents] = await Promise.all([
    loadAllReports(),
    loadAllUsersByRole('student')
  ]);
  
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s.full_name || s.name || s.email; });
  
  const reportCards = allReports.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(r => `
    <div class="card panel" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h4>${escapeHtml(studentMap[r.studentId] || r.studentId)} - ${escapeHtml(r.title || 'Progress Report')}</h4>
        <small>${fmtDate(r.createdAt)}</small>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0;">
        <div style="background:#e8f5e9;padding:12px;border-radius:8px;">
          <strong>✅ Strengths</strong>
          <p>${escapeHtml(r.strengths || '—')}</p>
        </div>
        <div style="background:#fff3e0;padding:12px;border-radius:8px;">
          <strong>⚠️ Areas for Improvement</strong>
          <p>${escapeHtml(r.lows || r.challenges || '—')}</p>
        </div>
      </div>
      <div style="background:#f0f7ff;padding:12px;border-radius:8px;">
        <strong>📝 Summary</strong>
        <p>${escapeHtml(r.summary || r.comment || '—')}</p>
      </div>
    </div>
  `).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid"><div class="stat-card"><div class="stat-number">${allReports.length}</div><p>Total Reports</p></div></div>
    <div class="card panel">
      <h3>📄 All Academic Reports</h3>
      ${reportCards || '<p class="empty">No reports generated yet</p>'}
    </div>
  `;
}

async function bootParentAllGrowthPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allGrowthNotes, allStudents] = await Promise.all([
    loadAllGrowthNotes(),
    loadAllUsersByRole('student')
  ]);
  
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s.full_name || s.name || s.email; });
  
  const noteCards = allGrowthNotes.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(n => `
    <div class="card panel" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <span class="badge ${n.type === 'Strength' ? 'success' : (n.type === 'Challenge' ? 'danger' : 'warn')}">${escapeHtml(n.type || 'Note')}</span>
        <small>${escapeHtml(studentMap[n.studentId] || n.studentId)} • ${fmtDate(n.createdAt)}</small>
      </div>
      <p style="margin-top:12px;">${escapeHtml(n.note || n.comment || '—')}</p>
      ${n.milestone ? `<small>🎯 Milestone: ${escapeHtml(n.milestone)}</small>` : ''}
    </div>
  `).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="card panel">
      <h3>🌱 Growth & Development Notes</h3>
      <p>Track social-emotional growth, behavioral observations, and developmental milestones across all students.</p>
      ${noteCards || '<p class="empty">No growth notes recorded yet</p>'}
    </div>
  `;
}

async function bootParentAllPortfolioPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const [allPortfolios, allStudents] = await Promise.all([
    loadAllPortfolios(),
    loadAllUsersByRole('student')
  ]);
  
  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s.full_name || s.name || s.email; });
  
  // Group by student
  const grouped = {};
  allPortfolios.forEach(item => {
    if (!grouped[item.studentId]) grouped[item.studentId] = [];
    grouped[item.studentId].push(item);
  });
  
  const portfolioHtml = Object.entries(grouped).map(([studentId, items]) => `
    <section class="card panel" style="margin-bottom:20px;">
      <h3>🌟 ${escapeHtml(studentMap[studentId] || studentId)}'s Portfolio</h3>
      ${items.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(item => `
        <div style="margin-top:12px;padding:12px;background:#f8f9fa;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;">
            <span class="badge">${escapeHtml(item.type || 'Entry')}</span>
            <small>${fmtDate(item.createdAt)}</small>
          </div>
          <h4 style="margin:8px 0;">${escapeHtml(item.title || 'Untitled')}</h4>
          <p>${escapeHtml(item.note || '')}</p>
          ${item.fileUrl ? renderFilePreview(item.fileUrl, item.fileName) : ''}
        </div>
      `).join('')}
    </section>
  `).join('');
  
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid"><div class="stat-card"><div class="stat-number">${allPortfolios.length}</div><p>Total Portfolio Entries</p></div></div>
    ${portfolioHtml || '<div class="card panel"><p class="empty">No portfolio entries yet</p></div>'}
  `;
}

async function bootParentSettingsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const { user, profile } = bundle;
  const allStudents = await loadAllUsersByRole('student');
  const allTutors = await loadAllUsersByRole('tutor');
  
  document.getElementById('page-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div class="card panel">
        <h3>👤 Profile Information</h3>
        <div style="padding:16px 0;">
          <div style="margin-bottom:16px;"><strong>Name:</strong> ${escapeHtml(profile?.name || profile?.full_name || '—')}</div>
          <div style="margin-bottom:16px;"><strong>Email:</strong> ${escapeHtml(profile?.email || '—')}</div>
          <div style="margin-bottom:16px;"><strong>Role:</strong> ${escapeHtml(profile?.role || 'Parent')} (Supervisor)</div>
          <div><strong>Account Created:</strong> ${fmtDate(profile?.createdAt)}</div>
        </div>
      </div>
      
      <div class="card panel">
        <h3>📊 System Statistics</h3>
        <div style="padding:16px 0;">
          <div style="margin-bottom:12px;"><strong>Total Students:</strong> ${allStudents.length}</div>
          <div style="margin-bottom:12px;"><strong>Total Tutors:</strong> ${allTutors.length}</div>
          <div><strong>Access Level:</strong> <span class="badge success">Full System Access</span></div>
        </div>
      </div>
      
      <div class="card panel">
        <h3>🔔 Notification Preferences</h3>
        <form id="notificationPrefsForm">
          <div style="margin-bottom:12px;"><label><input type="checkbox" id="notifyAll" checked> All system notifications</label></div>
          <button type="submit" class="btn small">Save Preferences</button>
          <span id="prefMsg"></span>
        </form>
      </div>
      
      <div class="card panel">
        <h3>🔒 Security</h3>
        <button class="btn ghost" id="changePasswordBtn">Change Password</button>
        <button class="btn danger" id="logoutSettingsBtn" style="margin-left:12px;">Logout</button>
      </div>
    </div>
  `;
  
  const logoutBtn = document.getElementById('logoutSettingsBtn');
  if (logoutBtn) logoutBtn.onclick = async () => { await signOut(auth); location.href = '/login.html'; };
  
  const changePwdBtn = document.getElementById('changePasswordBtn');
  if (changePwdBtn) changePwdBtn.onclick = async () => {
    const email = prompt('Enter your email to receive password reset link:');
    if (email) { await sendPasswordResetEmail(auth, email); alert('Password reset email sent!'); }
  };
}

// ============================================
// LOADER FUNCTIONS - FETCH ALL DATA FROM FIRESTORE
// ============================================

async function loadAllUsersByRole(role) {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', role)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllAssignments() {
  const snap = await getDocs(collection(db, 'assignments'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllAssessments() {
  const snap = await getDocs(collection(db, 'assessments'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllSubmissions() {
  const snap = await getDocs(collection(db, 'submissions'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllAttendance() {
  const snap = await getDocs(collection(db, 'attendance'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllResources() {
  const snap = await getDocs(collection(db, 'resources'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllMessages() {
  const snap = await getDocs(collection(db, 'messages'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllReports() {
  const snap = await getDocs(collection(db, 'reports'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllGrowthNotes() {
  const snap = await getDocs(collection(db, 'growth-notes'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllClassrooms() {
  const snap = await getDocs(collection(db, 'classrooms'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllStudentNotes() {
  const snap = await getDocs(collection(db, 'student-notes'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


async function bootStudentDashboard() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user, profile } = bundle;
  const [assignments, submissions, assessments, notifications, portfolioItems, resources] = await Promise.all([
    loadStudentAssignments(user.uid), loadStudentSubmissions(user.uid), loadStudentAssessments(user.uid),
    loadStudentNotifications(user.uid), loadStudentPortfolio(user.uid), loadStudentResources(user.uid)
  ]);
  document.getElementById('page-content').innerHTML = renderStudentDashboard(profile, assignments, submissions, assessments, notifications, portfolioItems, resources);
  document.querySelectorAll('.notification-item').forEach(el => {
    el.addEventListener('click', async () => {
      if (el.classList.contains('unread')) {
        await updateDoc(doc(db, 'notifications', el.dataset.id), { read: true });
        el.classList.remove('unread');
        el.style.background = 'white';
      }
    });
  });
}


async function bootStudentAssignmentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user } = bundle;
  const [assignments, submissions] = await Promise.all([loadStudentAssignments(user.uid), loadStudentSubmissions(user.uid)]);
  document.getElementById('page-content').innerHTML = renderStudentAssignmentsPage(assignments, submissions);
}

async function bootStudentAssessmentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user } = bundle;
  const assessments = await loadStudentAssessments(user.uid);
  document.getElementById('page-content').innerHTML = renderStudentAssessmentsPage(assessments);
}

async function bootStudentResourcesPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user } = bundle;
  const resources = await loadStudentResources(user.uid);
  document.getElementById('page-content').innerHTML = renderStudentResourcesPage(resources);
}

async function bootStudentPortfolioPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user, profile } = bundle;
  const items = await loadStudentPortfolio(user.uid);
  document.getElementById('page-content').innerHTML = renderStudentPortfolioPage(items);
  
  const form = document.getElementById('portfolioForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('portfolioType').value;
      const title = document.getElementById('portfolioTitle').value;
      const note = document.getElementById('portfolioNote').value;
      const file = document.getElementById('portfolioFile').files[0];
      const feeling = document.getElementById('portfolioFeeling')?.value || '';
      
      const upload = file ? await uploadFile(file, `portfolio/${user.uid}`) : { url: '' };
      await addDoc(collection(db, 'portfolio'), {
        studentId: user.uid, studentName: getStudentDisplayName(profile, user),
        type, title, note, feeling, fileUrl: upload.url, fileName: upload.name,
        createdAt: serverTimestamp()
      });
      form.reset();
      bootStudentPortfolioPage();
    });
  }
}


async function bootStudentReportsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user } = bundle;
  const reports = await loadStudentReports(user.uid);
  document.getElementById('page-content').innerHTML = renderStudentReportsPage(reports);
}

async function bootStudentAttendancePage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user } = bundle;
  const records = await loadStudentAttendance(user.uid);
  document.getElementById('page-content').innerHTML = renderStudentAttendancePage(records);
}


async function bootStudentActivitiesPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user } = bundle;
  const items = await loadStudentActivities(user.uid);
  document.getElementById('page-content').innerHTML = renderStudentActivitiesPage(items);
}

async function bootStudentMessagesPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user } = bundle;
  const messages = await loadStudentMessages(user.uid);
  document.getElementById('page-content').innerHTML = renderStudentMessagesPage(messages);
}

async function bootStudentSettingsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user, profile } = bundle;
  const studentDoc = await getDoc(doc(db, 'students', user.uid));
  const studentRecord = studentDoc.exists() ? studentDoc.data() : {};
  document.getElementById('page-content').innerHTML = renderStudentSettingsPage(profile, user, studentRecord);
}

async function bootSubmitWorkPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user, profile } = bundle;
  const params = new URLSearchParams(window.location.search);
  const forcedId = params.get('assignmentId');
  const [assignments, submissions] = await Promise.all([loadStudentAssignments(user.uid), loadStudentSubmissions(user.uid)]);
  document.getElementById('page-content').innerHTML = renderSubmitWorkPage(profile, user, assignments, submissions);
  if (forcedId && document.getElementById('assignmentId')) document.getElementById('assignmentId').value = forcedId;
  const form = document.getElementById('submissionForm');
  const msg = document.getElementById('submitWorkMsg');
  const submitBtn = document.getElementById('submitWorkBtn');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const assignmentId = document.getElementById('assignmentId').value;
      const note = document.getElementById('submissionNote')?.value || '';
      const file = document.getElementById('submissionFile').files[0];
      if (!assignmentId) { msg.innerHTML = 'Please select an assignment'; return; }
      if (submitBtn) submitBtn.disabled = true;
      msg.innerHTML = 'Submitting...';
      try {
        const assignmentDoc = await getDoc(doc(db, 'assignments', assignmentId));
        const assignment = assignmentDoc.data();
        const upload = file ? await uploadFile(file, `submissions/${user.uid}`) : { url: '' };
        await addDoc(collection(db, 'submissions'), { assignmentId, assignmentTitle: assignment?.title || 'Assignment', subject: assignment?.subject || '', studentId: user.uid, studentName: getStudentDisplayName(profile, user), note, fileUrl: upload.url, fileName: upload.name, status: 'Submitted', submittedAt: serverTimestamp(), createdAt: serverTimestamp() });
        msg.innerHTML = '✅ Work submitted successfully!';
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        msg.innerHTML = 'Error: ' + err.message;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

// ============================================
// BOOT FUNCTIONS - TUTOR (FIXES INTEGRATED HERE)
// ============================================

async function bootTutorDashboard() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user } = bundle;
  const [students, assignments, assessments, classrooms] = await Promise.all([
    loadAllStudents(),
    loadTutorAssignments(user.uid),
    loadTutorAssessments(user.uid),
    loadClassrooms(user.uid)
  ]);
  
  document.getElementById('page-content').innerHTML = renderTutorDashboard(students, assignments, assessments, classrooms);
}

async function bootTutorAssignmentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user, profile } = bundle;
  const [assignments, classrooms, students] = await Promise.all([
    loadTutorAssignments(user.uid), 
    loadClassrooms(user.uid), 
    loadAllStudents()
  ]);
  
  document.getElementById('page-content').innerHTML = renderTutorAssignmentsPage(assignments, classrooms, students);
  
  const targetSelect = document.getElementById('assignTarget');
  const classroomRow = document.getElementById('classroomSelectRow');
  const studentRow = document.getElementById('studentSelectRow');
  if (targetSelect) {
    targetSelect.addEventListener('change', (e) => {
      classroomRow.style.display = e.target.value === 'classroom' ? 'block' : 'none';
      studentRow.style.display = e.target.value === 'student' ? 'block' : 'none';
    });
  }
  
  const form = document.getElementById('assignmentForm');
  const msg = document.getElementById('assignMsg');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('assignTitle').value.trim();
      if (!title) { msg.textContent = 'Please enter an assignment title'; return; }
      
      msg.textContent = 'Creating assignment...';
      
      try {
        const target = document.getElementById('assignTarget').value;
        const classroomId = document.getElementById('assignClassroomId')?.value;
        const studentId = document.getElementById('assignStudentId')?.value;
        
        const assignmentData = {
          tutorId: user.uid, tutorName: profile?.name || profile?.full_name || user.email,
          title, subject: document.getElementById('assignSubject').value,
          description: document.getElementById('assignDescription').value,
          dueDate: document.getElementById('assignDueDate').value || null,
          targetType: target, status: 'Active', createdAt: serverTimestamp()
        };
        
        if (target === 'classroom' && classroomId) {
          const classroom = classrooms.find(c => c.id === classroomId);
          assignmentData.classroomId = classroomId;
          assignmentData.classroomName = classroom?.name;
          const classroomStudents = students.filter(s => s.classroomId === classroomId);
          for (const s of classroomStudents) await createAssignmentNotification(s.id, title, 'pending');
        } else if (target === 'student' && studentId) {
          assignmentData.studentId = studentId;
          const student = students.find(s => s.id === studentId);
          assignmentData.studentName = student?.full_name || student?.name;
          await createAssignmentNotification(studentId, title, 'pending');
        } else {
          for (const s of students) await createAssignmentNotification(s.id, title, 'pending');
        }
        
        await addDoc(collection(db, 'assignments'), assignmentData);
        msg.textContent = '✅ Assignment created successfully!';
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
      }
    });
  }
  
  document.querySelectorAll('.view-submissions-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const row = document.getElementById(`submissions-${id}`);
      if (row.style.display === 'none') {
        row.style.display = 'table-row';
        const container = document.querySelector(`.submissions-container[data-assignment-id="${id}"]`);
        const subs = await getDocs(query(collection(db, 'submissions'), where('assignmentId', '==', id)));
        container.innerHTML = subs.docs.map(d => {
          const sub = d.data();
          return `<div class="submission-item"><div style="display:flex;justify-content:space-between;"><div><strong>${escapeHtml(sub.studentName)}</strong><br><small>${fmtDate(sub.submittedAt)}</small>${sub.note ? `<p>${escapeHtml(sub.note)}</p>` : ''}${sub.fileUrl ? `<a href="${sub.fileUrl}" target="_blank" class="btn small ghost">📎 View File</a>` : ''}</div><div><span class="badge warn">${sub.status || 'Submitted'}</span></div></div></div>`;
        }).join('') || '<p class="empty">No submissions yet.</p>';
      } else { row.style.display = 'none'; }
    });
  });
  
  document.querySelectorAll('.delete-assignment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this assignment? This cannot be undone.')) {
        await deleteDoc(doc(db, 'assignments', btn.dataset.id));
        location.reload();
      }
    });
  });
}

async function bootTutorAssessmentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user, profile } = bundle;
  const [assessments, students] = await Promise.all([
    loadTutorAssessments(user.uid), 
    loadAllStudents()
  ]);
  
  document.getElementById('page-content').innerHTML = renderTutorAssessmentsPage(assessments, students);
  
  const form = document.getElementById('assessmentForm');
  const msg = document.getElementById('assessMsg');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('assessTitle').value.trim();
      const studentId = document.getElementById('assessStudentId').value;
      if (!title || !studentId) { msg.textContent = 'Please fill all required fields'; return; }
      
      const student = students.find(s => s.id === studentId);
      msg.textContent = 'Creating assessment...';
      
      try {
        await createAssessment({
          tutorId: user.uid, tutorName: profile?.name || profile?.full_name || user.email,
          studentId, studentName: student?.full_name || student?.name || student?.email,
          title, subject: document.getElementById('assessSubject').value,
          description: document.getElementById('assessDescription').value,
          maxScore: parseFloat(document.getElementById('assessMaxScore').value) || null,
          score: null, feedback: '', status: 'Pending'
        });
        msg.textContent = '✅ Assessment created successfully!';
        setTimeout(() => location.reload(), 1500);
      } catch (err) { msg.textContent = 'Error: ' + err.message; }
    });
  }
  
  let currentId = null;
  const modal = document.getElementById('gradeModal');
  const saveBtn = document.getElementById('saveGradeBtn');
  const closeBtn = document.getElementById('closeGradeModalBtn');
  const scoreInput = document.getElementById('gradeScore');
  const feedbackInput = document.getElementById('gradeFeedback');
  
  document.querySelectorAll('.grade-assessment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentId = btn.dataset.id;
      document.getElementById('gradeModalTitle').textContent = `Grade: ${btn.dataset.title} - ${btn.dataset.student}`;
      scoreInput.value = btn.dataset.score || '';
      feedbackInput.value = btn.dataset.feedback || '';
      modal.style.display = 'flex';
    });
  });
  
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const score = parseFloat(scoreInput.value);
    if (isNaN(score)) { alert('Please enter a valid score'); return; }
    await updateAssessmentGrade(currentId, score, feedbackInput.value);
    modal.style.display = 'none';
    location.reload();
  });
  if (closeBtn) closeBtn.addEventListener('click', () => modal.style.display = 'none');
  
  document.querySelectorAll('.delete-assessment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this assessment?')) {
        await deleteDoc(doc(db, 'assessments', btn.dataset.id));
        location.reload();
      }
    });
  });
}

async function bootLessonPlansPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user, profile } = bundle;
  const lessonPlans = await loadTutorLessonPlans(user.uid);
  document.getElementById('page-content').innerHTML = renderLessonPlansPage(profile, lessonPlans, null);
  
  const form = document.getElementById('lessonPlanForm');
  const msg = document.getElementById('lessonPlanMsg');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const planId = document.getElementById('planId').value;
      const title = document.getElementById('planTitle').value.trim();
      const subject = document.getElementById('planSubject').value.trim();
      const classroomName = document.getElementById('planClassroom').value.trim();
      const plannedDate = document.getElementById('planDate').value;
      const objectives = document.getElementById('planObjectives').value;
      const materials = document.getElementById('planMaterials').value;
      const notes = document.getElementById('planNotes').value;
      const file = document.getElementById('planAttachment').files[0];
      
      if (!title || !subject || !classroomName || !plannedDate) {
        msg.textContent = 'Please fill all required fields.';
        return;
      }
      
      let attachmentUrl = '', attachmentName = '';
      if (file) {
        const upload = await uploadFile(file, `lesson-plans/${user.uid}`);
        attachmentUrl = upload.url;
        attachmentName = upload.name;
      }
      
      const payload = { title, subject, classroomName, plannedDate, objectives, materials, notes, attachmentUrl, attachmentName, tutorId: user.uid, tutorName: profile?.name || user.email, status: 'Draft', updatedAt: serverTimestamp() };
      
      if (planId) {
        await updateDoc(doc(db, 'lesson-plans', planId), payload);
        msg.textContent = 'Lesson plan updated.';
      } else {
        await addDoc(collection(db, 'lesson-plans'), { ...payload, createdAt: serverTimestamp() });
        msg.textContent = 'Lesson plan saved.';
      }
      setTimeout(() => location.reload(), 1500);
    });
  }
}
async function bootLearnersPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user } = bundle;
  const students = await loadAllStudents();
  const notes = await loadLearnerNotes(user.uid);
  
  document.getElementById('page-content').innerHTML = renderLearnersPage(students, notes);
  
  // Handle form submission
  const form = document.getElementById('learnerNoteForm');
  const msg = document.getElementById('learnerNoteMsg');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = document.getElementById('noteStudentId').value;
      const comment = document.getElementById('noteComment').value.trim();
      
      if (!studentId || !comment) {
        msg.textContent = 'Please select a student and enter a comment.';
        msg.style.color = 'red';
        return;
      }
      
      const student = students.find(s => s.id === studentId);
      msg.textContent = 'Saving...';
      msg.style.color = 'blue';
      
      try {
        await addDoc(collection(db, 'student-notes'), {
          tutorId: user.uid,
          studentId: studentId,
          studentName: student?.full_name || student?.name || student?.email,
          comment: comment,
          createdAt: serverTimestamp()
        });
        msg.textContent = '✅ Comment saved successfully!';
        msg.style.color = 'green';
        document.getElementById('noteComment').value = '';
        setTimeout(() => {
          bootLearnersPage(); // Refresh the page
        }, 1500);
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
        msg.style.color = 'red';
      }
    });
  }
  
  // Handle "Add Comment" buttons
  document.querySelectorAll('.add-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.dataset.id;
      const studentName = btn.dataset.name;
      const select = document.getElementById('noteStudentId');
      if (select) {
        select.value = studentId;
        // Scroll to form
        document.querySelector('.card.panel').scrollIntoView({ behavior: 'smooth' });
        // Focus on comment textarea
        const commentArea = document.getElementById('noteComment');
        if (commentArea) {
          commentArea.focus();
          commentArea.placeholder = `Write a comment for ${studentName}...`;
        }
      }
    });
  });
  
  // Handle "View Notes" buttons
  document.querySelectorAll('.view-notes-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const studentId = btn.dataset.id;
      const studentName = btn.dataset.name;
      const studentNotes = notes.filter(n => n.studentId === studentId);
      
      const modal = document.getElementById('notesModal');
      const modalTitle = document.getElementById('notesModalTitle');
      const modalBody = document.getElementById('notesModalBody');
      
      modalTitle.textContent = `${studentName}'s Notes (${studentNotes.length})`;
      
      if (studentNotes.length === 0) {
        modalBody.innerHTML = '<p class="empty">No comments yet. Add one using the form above.</p>';
      } else {
        modalBody.innerHTML = studentNotes.map(note => `
          <div class="comment-item">
            <strong>📝 Comment</strong>
            <div class="comment-date">${fmtDate(note.createdAt)}</div>
            <p style="margin-top: 8px;">${escapeHtml(note.comment)}</p>
          </div>
        `).join('');
      }
      
      modal.style.display = 'flex';
    });
  });
}

async function bootClassroomsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user } = bundle;
  const classrooms = await loadClassrooms(user.uid);
  const students = await loadAllStudents();
  document.getElementById('page-content').innerHTML = renderClassroomsPage(classrooms, students);
  
  const form = document.getElementById('classroomForm');
  const msg = document.getElementById('classroomMsg');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('classroomName').value.trim();
      const subject = document.getElementById('classroomSubject').value.trim();
      const description = document.getElementById('classroomDescription').value.trim();
      const selected = [...document.getElementById('classroomStudents').selectedOptions];
      const studentIds = selected.map(opt => opt.value);
      if (!name || !subject) { msg.textContent = 'Enter classroom name and subject.'; return; }
      
      const classroomRef = await addDoc(collection(db, 'classrooms'), { tutorId: user.uid, name, subject, description, studentIds, createdAt: serverTimestamp() });
      const batch = writeBatch(db);
      studentIds.forEach(id => {
        batch.update(doc(db, 'users', id), { classroomId: classroomRef.id, classroomName: name });
        batch.update(doc(db, 'students', id), { classroomId: classroomRef.id, classroomName: name });
      });
      await batch.commit();
      msg.textContent = 'Classroom saved.';
      setTimeout(() => bootClassroomsPage(), 1000);
    });
  }
}

async function bootResourcesPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user } = bundle;
  const resources = await loadResources(user.uid);
  const classrooms = await loadClassrooms(user.uid);
  const students = await loadAllStudents();
  document.getElementById('page-content').innerHTML = renderResourcesPage(resources, classrooms, students);
  
  const form = document.getElementById('resourceForm');
  const msg = document.getElementById('resourceMsg');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('resourceTitle').value.trim();
      if (!title) { msg.textContent = 'Enter title'; return; }
      
      const file = document.getElementById('resourceFile').files[0];
      const upload = file ? await uploadFile(file, `resources/${user.uid}`) : { url: '' };
      const classroomId = document.getElementById('resourceClassroomId').value;
      const studentId = document.getElementById('resourceStudentId').value;
      const classroom = classrooms.find(c => c.id === classroomId);
      const student = students.find(s => s.id === studentId);
      
      await addDoc(collection(db, 'resources'), {
        tutorId: user.uid, title, type: document.getElementById('resourceType').value,
        note: document.getElementById('resourceNote').value,
        classroomId, classroomName: classroom?.name || '',
        studentId, studentName: student?.full_name || '',
        fileUrl: upload.url, fileName: upload.name, createdAt: serverTimestamp()
      });
      msg.textContent = 'Saved!';
      setTimeout(() => bootResourcesPage(), 1000);
    });
  }
}

async function bootMessagesPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user } = bundle;
  const messages = await loadMessagesForTutor(user.uid);
  const students = await loadAllStudents();
  document.getElementById('page-content').innerHTML = renderMessagesPage(messages, students);
}

function renderMessagesPage(messages, students) {
  const rows = messages.map(m => `<div class="card panel" style="margin-bottom:12px"><h4>To: ${escapeHtml(m.studentName)}</h4><strong>${escapeHtml(m.subject)}</strong><p>${escapeHtml(m.message)}</p><small>${fmtDate(m.createdAt)}</small></div>`).join('');
  return `
    <section class="card panel"><h3>Send Message</h3><form id="messageForm"><select id="messageStudentId" required><option value="">Select Student</option>${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('')}</select><input id="messageSubject" placeholder="Subject"><textarea id="messageBody" rows="4" placeholder="Message"></textarea><button type="submit" class="btn">Send</button><span id="messageMsg"></span></form></section>
    <section class="card panel" style="margin-top:24px"><h3>Sent Messages</h3>${rows || '<p class="empty">No messages sent yet.</p>'}</section>
  `;
}



async function bootParentChildrenPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const { user } = bundle;
  const children = await loadParentChildren(user.uid);
  document.getElementById('page-content').innerHTML = renderParentChildrenPage(children);
  
  document.querySelectorAll('.view-portfolio-btn').forEach(btn => {
    btn.addEventListener('click', () => window.location.href = `/parent/portfolio.html?childId=${btn.dataset.id}`);
  });
}

function renderParentChildrenPage(children) {
  const cards = children.map(child => `<div class="card panel" style="margin-bottom:16px"><h3>${escapeHtml(child.full_name || child.name || 'Student')}</h3><p>Grade: ${escapeHtml(child.grade_level || '—')}</p><button class="btn view-portfolio-btn" data-id="${child.id}">View Portfolio</button></div>`).join('');
  return `<section class="card panel"><h3>Your Children</h3>${children.length ? cards : '<div class="empty">No children linked</div>'}</section>`;
}

async function bootParentPortfolioPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const params = new URLSearchParams(window.location.search);
  const childId = params.get('childId');
  if (!childId) { document.getElementById('page-content').innerHTML = '<div class="empty">No child selected</div>'; return; }
  
  const items = await loadChildPortfolio(childId);
  const child = (await loadParentChildren(bundle.user.uid)).find(c => c.id === childId);
  document.getElementById('page-content').innerHTML = renderParentPortfolio(items, child);
}

function renderParentPortfolio(items, child) {
  const rows = items.map(item => `<div class="card panel" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><span class="badge">${escapeHtml(item.type || 'Entry')}</span><small>${fmtDate(item.createdAt)}</small></div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.note)}</p>${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" class="btn small ghost">View File</a>` : ''}</div>`).join('');
  return `<section class="card panel"><h3>${escapeHtml(child?.full_name || child?.name || 'Student')}'s Portfolio</h3>${rows || '<p class="empty">No portfolio entries yet.</p>'}</section>`;
}

async function bootTutorPortfolios() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const items = await loadAllPortfolios();
  const grouped = {};
  items.forEach(item => { if (!grouped[item.studentId]) grouped[item.studentId] = { name: item.studentName || 'Student', entries: [] }; grouped[item.studentId].entries.push(item); });
  const html = Object.values(grouped).map(s => `<section class="card panel" style="margin-bottom:20px"><h3>${escapeHtml(s.name)}</h3>${s.entries.map(e => `<div style="margin-top:12px;padding:12px;background:var(--surface-2);border-radius:12px"><strong>${escapeHtml(e.type || '')}</strong> <small style="float:right">${fmtDate(e.createdAt)}</small><p>${escapeHtml(e.note || '')}</p>${e.fileUrl ? renderFilePreview(e.fileUrl, e.fileName) : ''}</div>`).join('')}</section>`).join('');
  document.getElementById('page-content').innerHTML = html || '<div class="empty">No portfolios yet</div>';
}

async function bootReportsPage() {
  const bundle = await requireAuth();
  if (!bundle) return;
  
  if (bundle.profile?.role === 'student') {
    await bootStudentReportsPage();
    return;
  }
  
  if (bundle.profile?.role !== 'tutor') { bootDefaultPage(); return; }
  
  const { user } = bundle;
  const students = await loadAllStudents();
  const rows = students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('');
  document.getElementById('page-content').innerHTML = `<section class="card panel"><h3>Create Report</h3><form id="reportForm"><select id="reportStudent">${rows}</select><textarea id="reportStrengths" placeholder="Strengths"></textarea><textarea id="reportLows" placeholder="Challenges"></textarea><textarea id="reportSummary" placeholder="Summary"></textarea><button class="btn">Save Report</button></form></section>`;
  
  document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'reports'), {
      tutorId: user.uid, studentId: document.getElementById('reportStudent').value,
      strengths: document.getElementById('reportStrengths').value,
      lows: document.getElementById('reportLows').value,
      summary: document.getElementById('reportSummary').value,
      createdAt: serverTimestamp()
    });
    alert('Report saved');
    bootReportsPage();
  });
}

async function bootDefaultPage() {
  const bundle = await requireAuth();
  if (!bundle) return;
  document.getElementById('page-content').innerHTML = `<section class="card panel"><h3>${escapeHtml(pageTitle)}</h3><p>This page is connected successfully.</p><p>Role: ${escapeHtml(bundle.profile?.role)}</p><p>Email: ${escapeHtml(bundle.user?.email)}</p></section>`;
}

// ============================================
// PAGE ROUTER
// ============================================

const routeMap = {
  student: {
    'dashboard': bootStudentDashboard,
    'assignments': bootStudentAssignmentsPage,
    'assessments': bootStudentAssessmentsPage,
    'activities': bootStudentActivitiesPage,
    'attendance': bootStudentAttendancePage,
    'resources': bootStudentResourcesPage,
    'portfolio': bootStudentPortfolioPage,
    'submit-work': bootSubmitWorkPage,
    'messages': bootStudentMessagesPage,
    'reports': bootStudentReportsPage,
    'report-card': bootStudentReportsPage,
    'settings': bootStudentSettingsPage
  },
  tutor: {
    'dashboard': bootTutorDashboard,
    'assignments': bootTutorAssignmentsPage,
    'assessments': bootTutorAssessmentsPage,
    'resources': bootResourcesPage,
    'portfolio': bootTutorPortfolios,
    'lesson-plans': bootLessonPlansPage,
    'learners': bootLearnersPage,
    'classrooms': bootClassroomsPage,
    'messages': bootMessagesPage,
    'reports': bootReportsPage
  },
  parent: {
    'dashboard': bootParentSuperDashboard,
    'children': bootParentAllStudentsPage,
    'assignments': bootParentAllAssignmentsPage,
    'assessments': bootParentAllAssessmentsPage,
    'attendance': bootParentAllAttendancePage,
    'messages': bootParentAllMessagesPage,
    'resources': bootParentAllResourcesPage,
    'settings': bootParentSettingsPage,
    'reports': bootParentAllReportsPage,
    'growth': bootParentAllGrowthPage,
    'portfolio': bootParentAllPortfolioPage
  }
};

async function initRouter() {
  if (pageRole && pageKey && routeMap[pageRole] && routeMap[pageRole][pageKey]) {
    await routeMap[pageRole][pageKey]();
  } else {
    await bootDefaultPage();
  }
}

initRouter();

// ============================================
// GLOBALS
// ============================================

window.AppUtil = { auth, db, storage, requireAuth, getUserProfile, uploadFile, fmtDate, statusBadge, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile };
window.openFileModal = openFileModal;
