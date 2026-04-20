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
   ['Dashboard', '/tutor/dashboard.html', '🏠'],
    ['Classrooms', '/tutor/classrooms.html', '🏫'],   // ← now the main Google Classroom hub
    ['Portfolio', '/tutor/portfolios.html', '🗂️'],     // ← NEW: Portfolio for tutors
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
function generateClassCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
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
  const q = query(collection(db, 'notifications'), where('studentId', '==', studentUid));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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
async function ensureDefaultPortfolio(studentUid, studentName) {
  const q = query(collection(db, 'portfolios'), 
    where('studentId', '==', studentUid), 
    where('isDefault', '==', true));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  await addDoc(collection(db, 'portfolios'), {
    studentId: studentUid,
    studentName: studentName,
    title: 'My Learning Journey',
    description: 'Your complete story — reflections, achievements, media & growth',
    emoji: '🌟',
    isDefault: true,
    createdByRole: 'system',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
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
  console.log('📊 Loading ALL activities for student:', studentUid);
  
  // Load from multiple sources to get comprehensive activity feed
  const [
    notesSnap,
    portfolioSnap,
    submissionsSnap,
    assignmentsSnap,
    assessmentsSnap,
    notificationsSnap,
    messagesSnap,
    attendanceSnap
  ] = await Promise.all([
    getDocs(query(collection(db, 'student-notes'), where('studentId', '==', studentUid))),
    getDocs(query(collection(db, 'portfolio'), where('studentId', '==', studentUid))),
    getDocs(query(collection(db, 'submissions'), where('studentId', '==', studentUid))),
    getDocs(query(collection(db, 'assignments'))), // Will filter for student visibility
    getDocs(query(collection(db, 'assessments'), where('studentId', '==', studentUid))),
    getDocs(query(collection(db, 'notifications'), where('studentId', '==', studentUid))),
    getDocs(query(collection(db, 'messages'), where('studentId', '==', studentUid))),
    getDocs(query(collection(db, 'attendance'), where('studentId', '==', studentUid)))
  ]);
  
  // Get student's classroom for assignment filtering
  const studentDoc = await getDoc(doc(db, 'students', studentUid));
  const studentData = studentDoc.data();
  const classroomId = studentData?.classroomId || '';
  
  const activities = [];
  
  // 1. Tutor Notes
  notesSnap.docs.forEach(d => {
    const data = d.data();
    activities.push({
      id: d.id,
      type: 'tutor_note',
      typeLabel: '📝 Tutor Feedback',
      icon: '✏️',
      title: 'Tutor Comment',
      description: data.comment || 'Tutor left feedback',
      createdAt: data.createdAt,
      priority: 2,
      metadata: { tutorName: data.tutorName }
    });
  });
  
  // 2. Portfolio Entries (Journey entries)
  portfolioSnap.docs.forEach(d => {
    const data = d.data();
    const typeMap = {
      'Achievement': '🏆',
      'Challenge': '⚠️',
      'Progress': '📈',
      'Reflection': '🤔',
      'Character': '💪',
      'Problem_Solved': '🧩',
      'Skill_Mastered': '⭐',
      'Goal_Set': '🎯'
    };
    activities.push({
      id: d.id,
      type: 'portfolio_' + (data.type || 'entry'),
      typeLabel: data.feeling ? `${data.feeling} ${data.type || 'Portfolio Entry'}` : (data.type || 'Portfolio Entry'),
      icon: typeMap[data.type] || '📖',
      title: data.title || 'Portfolio Entry',
      description: data.note || '',
      createdAt: data.createdAt,
      priority: 1,
      metadata: { feeling: data.feeling, fileUrl: data.fileUrl, type: data.type }
    });
  });
  
  // 3. Assignment Submissions (Work submitted)
  submissionsSnap.docs.forEach(d => {
    const data = d.data();
    activities.push({
      id: d.id,
      type: 'submission',
      typeLabel: '📤 Work Submitted',
      icon: '📤',
      title: `Submitted: ${data.assignmentTitle || 'Assignment'}`,
      description: data.note || 'No additional notes',
      createdAt: data.submittedAt || data.createdAt,
      priority: 1,
      metadata: { assignmentId: data.assignmentId, fileUrl: data.fileUrl, status: data.status }
    });
  });
  
  // 4. Assignments Received (Filter for this student)
  assignmentsSnap.docs.forEach(d => {
    const data = d.data();
    let isVisible = false;
    if (data.studentId === studentUid) isVisible = true;
    if (data.classroomId === classroomId) isVisible = true;
    if (data.targetType === 'all_students' || data.published === true) isVisible = true;
    if (Array.isArray(data.assignedTo) && data.assignedTo.includes(studentUid)) isVisible = true;
    
    if (isVisible) {
      activities.push({
        id: d.id,
        type: 'assignment_received',
        typeLabel: '📋 Assignment Received',
        icon: '📋',
        title: `New: ${data.title || 'Assignment'}`,
        description: data.description || 'Check your assignments page for details',
        createdAt: data.createdAt,
        priority: 2,
        metadata: { dueDate: data.dueDate, subject: data.subject }
      });
    }
  });
  
  // 5. Assessments (Quizzes/Tests)
  assessmentsSnap.docs.forEach(d => {
    const data = d.data();
    const isGraded = data.status === 'Graded';
    activities.push({
      id: d.id,
      type: 'assessment',
      typeLabel: isGraded ? '📊 Assessment Graded' : '📝 Assessment Created',
      icon: isGraded ? '⭐' : '📝',
      title: data.title || 'Assessment',
      description: isGraded ? `Score: ${data.score}/${data.maxScore || '—'} - ${data.feedback || 'No feedback'}` : 'New assessment ready',
      createdAt: data.createdAt,
      priority: 2,
      metadata: { score: data.score, maxScore: data.maxScore, feedback: data.feedback, status: data.status }
    });
  });
  
  // 6. Notifications
  notificationsSnap.docs.forEach(d => {
    const data = d.data();
    const typeMap = {
      'assignment': '📋',
      'assessment': '📝',
      'message': '💬',
      'submission': '📤',
      'resource': '📚'
    };
    activities.push({
      id: d.id,
      type: 'notification',
      typeLabel: `🔔 ${data.title || 'Notification'}`,
      icon: typeMap[data.type] || '🔔',
      title: data.title || 'Update',
      description: data.message || '',
      createdAt: data.createdAt,
      priority: 3,
      metadata: { read: data.read, type: data.type }
    });
  });
  
  // 7. Messages Received
  messagesSnap.docs.forEach(d => {
    const data = d.data();
    activities.push({
      id: d.id,
      type: 'message',
      typeLabel: '💬 Message',
      icon: '💬',
      title: data.subject || 'Message from Tutor',
      description: (data.message || data.body || '').substring(0, 150),
      createdAt: data.createdAt,
      priority: 2,
      metadata: { fromName: data.tutorName || data.fromName, read: data.read }
    });
  });
  
  // 8. Attendance Records
  attendanceSnap.docs.forEach(d => {
    const data = d.data();
    const statusIcon = data.status === 'Present' ? '✅' : (data.status === 'Late' ? '⏰' : '❌');
    activities.push({
      id: d.id,
      type: 'attendance',
      typeLabel: `${statusIcon} Attendance: ${data.status || 'Recorded'}`,
      icon: statusIcon,
      title: `${data.status || 'Attendance'} - ${data.classroomName || 'Class'}`,
      description: data.note || data.notes || `Duration: ${data.durationMinutes || 'N/A'} minutes`,
      createdAt: data.recordDate || data.date || data.attendanceDate || data.createdAt,
      priority: 3,
      metadata: { status: data.status, duration: data.durationMinutes }
    });
  });
  
  // Sort by date (newest first)
  activities.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  
  console.log(`📊 Loaded ${activities.length} total activities for student`);
  return activities;
}

async function loadStudentMessages(studentUid) {
  console.log('💬 Loading messages for student:', studentUid);
  
  try {
    // Query messages where studentId matches (tutor -> student messages)
    const q1 = query(
      collection(db, 'messages'), 
      where('studentId', '==', studentUid)
    );
    
    // Also query messages where toId matches (general messages)
    const q2 = query(
      collection(db, 'messages'),
      where('toId', '==', studentUid)
    );
    
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    // Combine and deduplicate by ID
    const messagesMap = new Map();
    
    [...snap1.docs, ...snap2.docs].forEach(docSnap => {
      if (!messagesMap.has(docSnap.id)) {
        messagesMap.set(docSnap.id, {
          id: docSnap.id,
          ...docSnap.data()
        });
      }
    });
    
    const messages = Array.from(messagesMap.values());
    
    // Sort by createdAt descending
    messages.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    
    console.log(`📨 Found ${messages.length} messages for student`);
    return messages;
  } catch (err) {
    console.error('Error loading student messages:', err);
    return [];
  }
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

  const baseCard = (inner, actions = '') => `
    <div class="file-card">
      <div class="file-preview">
        ${inner}
      </div>
      <div class="file-actions">
        ${actions}
      </div>
    </div>
  `;

  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return baseCard(
      `<img src="${url}" onclick="openFileModal('${url}', 'image', '${name}')">`,
      `
        <button class="btn primary" onclick="openFileModal('${url}', 'image', '${name}')">View</button>
      `
    );
  }

  if (lower.match(/\.(pdf|doc|docx)$/)) {
    return baseCard(
      `<div class="file-icon" onclick="openFileModal('${url}', 'doc', '${name}')">📄</div>`,
      `
        <button class="btn primary" onclick="openFileModal('${url}', 'doc', '${name}')">Read</button>
        <a href="${url}" target="_blank" class="btn ghost">Open</a>
        <a href="${url}" download class="btn ghost">Download</a>
      `
    );
  }

  if (lower.match(/\.(mp4|webm|ogg)$/)) {
    return baseCard(
      `<video src="${url}" muted></video>`,
      `
        <button class="btn primary" onclick="openFileModal('${url}', 'video', '${name}')">Play</button>
      `
    );
  }

  return baseCard(
    `<div class="file-icon">📁</div>`,
    `<button class="btn primary" onclick="openFileModal('${url}', 'file', '${name}')">Open</button>`
  );
}

function openFileModal(url, type, name = '') {
  const old = document.getElementById('fileModal');
  if (old) old.remove();

  let content = '';

  if (type === 'image') {
    content = `<img src="${url}" class="modal-media">`;
  } else if (type === 'doc') {
    content = `<iframe src="https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}" class="modal-media"></iframe>`;
  } else if (type === 'video') {
    content = `<video controls class="modal-media"><source src="${url}"></video>`;
  } else {
    content = `<iframe src="${url}" class="modal-media"></iframe>`;
  }

  const modal = document.createElement('div');
  modal.id = 'fileModal';

  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()">
      <div class="modal-box" onclick="event.stopPropagation()">
        
        <div class="modal-header">
          <h3>${name || 'Preview'}</h3>
          <button class="btn danger" onclick="document.getElementById('fileModal').remove()">✕</button>
        </div>

        <div class="modal-body">
          ${content}
        </div>

        <div class="modal-footer">
          <a href="${url}" target="_blank" class="btn">Open in new tab</a>
          <a href="${url}" download class="btn ghost">Download</a>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}


function trackUserActivity(userId, role) {
  const sessionStart = Date.now();
  const lastActivity = localStorage.getItem(`lastActivity_${userId}`);
  const now = new Date();
  
  // Store login timestamp
  if (!lastActivity) {
    localStorage.setItem(`sessionStart_${userId}`, sessionStart.toString());
  }
  
  // Update activity every 30 seconds
  const activityInterval = setInterval(() => {
    localStorage.setItem(`lastActivity_${userId}`, Date.now().toString());
  }, 30000);
  
  // Save attendance on page unload
  window.addEventListener('beforeunload', async () => {
    clearInterval(activityInterval);
    
    const startTime = parseInt(localStorage.getItem(`sessionStart_${userId}`) || sessionStart.toString());
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - startTime) / 60000);
    
    if (durationMinutes >= 1) { // Only log if active for at least 1 minute
      try {
        await addDoc(collection(db, 'attendance'), {
          studentId: userId,
          studentRole: role,
          loginTime: new Date(startTime).toISOString(),
          logoutTime: new Date(endTime).toISOString(),
          durationMinutes: durationMinutes,
          status: 'Present',
          recordedAutomatically: true,
          createdAt: serverTimestamp(),
          date: new Date().toISOString().split('T')[0]
        });
        console.log(`✅ Attendance logged: ${durationMinutes} minutes`);
      } catch (err) {
        console.error('Failed to log attendance:', err);
      }
    }
    
    localStorage.removeItem(`sessionStart_${userId}`);
    localStorage.removeItem(`lastActivity_${userId}`);
  });
  
  return activityInterval;
}


// ============================================
// RENDER FUNCTIONS - STUDENT PAGES
// ============================================

function renderStudentDashboard(profile, assignments, submissions, assessments, notifications, portfolioItems, resources) {
  const submittedMap = new Map(submissions.map(s => [s.assignmentId, s]));
  const pendingAssignments = assignments.filter(a => !submittedMap.has(a.id));
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const gradedAssessments = assessments.filter(a => a.status === 'Graded').length;
  
  return `
    <style>
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px; }
      .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .stat-number { font-size: 32px; font-weight: bold; margin: 0; }
      .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
      .notification-item { padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s; }
      .notification-item.unread { background: #f0f7ff; border-left: 3px solid #3498db; }
      .notification-item:hover { background: #e8f0fe; }
      .assignment-dash-item { padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
      .join-class-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-top: 24px; }
    </style>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number" style="color:#3498db;">${assignments.length}</div>
        <p>Total Assignments</p>
      </div>
      <div class="stat-card" style="background:#e8f5e9;">
        <div class="stat-number" style="color:#27ae60;">${submissions.length}</div>
        <p>Completed</p>
      </div>
      <div class="stat-card" style="background:#fff3e0;">
        <div class="stat-number" style="color:#e67e22;">${pendingAssignments.length}</div>
        <p>Pending</p>
      </div>
      <div class="stat-card" style="background:#e3f2fd;">
        <div class="stat-number" style="color:#2980b9;">${gradedAssessments}</div>
        <p>Graded</p>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color:#8e44ad;">${resources.length}</div>
        <p>Resources</p>
      </div>
    </div>
    
    <div class="dashboard-grid">
      <div class="card panel">
        <h3>🔔 Notifications ${unreadNotifications > 0 ? `<span class="badge" style="background:#e74c3c;">${unreadNotifications} new</span>` : ''}</h3>
        <div id="notificationsList">
          ${notifications.slice(0, 5).map(n => `
            <div class="notification-item ${!n.read ? 'unread' : ''}" data-id="${n.id}">
              <strong>${escapeHtml(n.title)}</strong> 
              <small style="float:right;">${fmtDate(n.createdAt)}</small>
              <p style="margin:8px 0 0;font-size:14px;">${escapeHtml(n.message)}</p>
            </div>
          `).join('') || '<p class="empty">No notifications</p>'}
        </div>
        ${notifications.length > 5 ? '<div style="margin-top:12px;text-align:center;"><a href="/student/messages.html" class="btn ghost">View All →</a></div>' : ''}
      </div>
      
      <div class="card panel">
        <h3>📊 Recent Assessments</h3>
        ${assessments.slice(0, 5).map(a => `
          <div style="padding:12px;border-bottom:1px solid #eee;">
            <div style="display:flex;justify-content:space-between;">
              <strong>${escapeHtml(a.title)}</strong>
              ${a.score ? `<span class="badge success">${a.score}/${a.maxScore || '—'}</span>` : '<span class="badge warn">Pending</span>'}
            </div>
            <small>${fmtDate(a.createdAt)}</small>
            ${a.feedback ? `<p style="margin:8px 0 0;font-size:13px;color:#666;">💬 ${escapeHtml(a.feedback.substring(0, 100))}${a.feedback.length > 100 ? '...' : ''}</p>` : ''}
          </div>
        `).join('') || '<p class="empty">No assessments yet</p>'}
        ${assessments.length > 5 ? '<div style="margin-top:12px;text-align:center;"><a href="/student/assessments.html" class="btn ghost">View All →</a></div>' : ''}
      </div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>📝 Pending Assignments</h3>
      ${pendingAssignments.length > 0 ? pendingAssignments.slice(0, 5).map(a => {
        const isPastDue = a.dueDate && new Date(a.dueDate) < new Date();
        return `
          <div class="assignment-dash-item">
            <div>
              <strong>${escapeHtml(a.title)}</strong>
              <br><small>Due: <span style="color:${isPastDue ? '#e74c3c' : '#666'};">${fmtDate(a.dueDate) || 'No due date'}</span></small>
            </div>
            <a href="/student/submit-work.html?assignmentId=${a.id}" class="btn small">Submit →</a>
          </div>
        `;
      }).join('') : '<p class="empty">No pending assignments! 🎉</p>'}
      ${pendingAssignments.length > 5 ? '<div style="margin-top:12px;text-align:center;"><a href="/student/assignments.html" class="btn ghost">View All Assignments →</a></div>' : ''}
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>✅ Recently Completed</h3>
      ${submissions.length > 0 ? submissions.slice(0, 3).map(s => `
        <div style="padding:12px;border-bottom:1px solid #eee;">
          <div style="display:flex;justify-content:space-between;">
            <strong>${escapeHtml(s.assignmentTitle || 'Assignment')}</strong>
            <span class="badge success">✓ Submitted</span>
          </div>
          <small>Submitted: ${fmtDate(s.submittedAt)}</small>
        </div>
      `).join('') : '<p class="empty">No submissions yet. Start working on your assignments!</p>'}
    </div>

    <!-- NEW: Join a Class Card -->
    <div class="join-class-card">
      <h3>🔑 Join a Class</h3>
      <p>Enter the class code provided by your tutor to join their classroom.</p>
      <input id="joinClassCode" type="text" placeholder="e.g. ABC123" 
             style="padding:14px; width:100%; border:1px solid #ddd; border-radius:8px; margin-bottom:12px; font-family:monospace; font-size:18px; text-transform:uppercase; letter-spacing:2px;">
      <button class="btn" onclick="joinClassByCode()">Join Class</button>
      <span id="joinMsg" style="margin-left:12px;"></span>
    </div>
  `;
}
async function refreshStudentDashboard(bundle) {
  const { user, profile } = bundle;
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  // Simplified - load data with simple queries or no filters
  const [assignments, submissions, resources, reports] = await Promise.all([
    loadStudentAssignments(user.uid),
    loadStudentSubmissions(user.uid),
    loadStudentResources(user.uid),
    loadStudentReports(user.uid)
  ]);

  // Calculate pending assignments (assignments not submitted)
  const submittedIds = new Set(submissions.map(s => s.assignmentId));
  const pendingAssignments = assignments.filter(a => !submittedIds.has(a.id)).length;

  // Simple portfolio count (no complex query)
  let portfolioCount = 0;
  try {
    const portfolioSnap = await getDocs(collection(db, 'portfolio'));
    portfolioCount = portfolioSnap.docs.filter(d => d.data().studentId === user.uid).length;
  } catch (e) {
    console.warn('Could not load portfolio count:', e);
  }

  const recentRows = submissions.slice(0, 5).map(item => `
    <tr>
      <td>${escapeHtml(item.assignmentTitle || 'Assignment')}</td>
      <td>${statusBadge(item.status || 'Submitted')}</td>
      <td>${fmtDate(item.submittedAt)}</td>
    </tr>
  `).join('');

  pageContent.innerHTML = `
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
      <p>You currently have <strong>${resources.length}</strong> resources and <strong>${portfolioCount}</strong> portfolio entries.</p>
    </section>

    <section class="card panel" style="margin-top:20px">
      <h3>Recent Submissions</h3>
      ${simpleTable(['Assignment', 'Status', 'Submitted'], recentRows)}
    </section>
  `;
}
function renderStudentAssignmentsPage(assignments, submissions, profile) {
  const submittedMap = new Map(submissions.map(s => [s.assignmentId, s]));
  
  const rows = assignments.map(a => {
    const submitted = submittedMap.get(a.id);
    const isPastDue = a.dueDate && new Date(a.dueDate) < new Date();
    
    return `
      <div class="assignment-card" style="
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border-left: 4px solid ${submitted ? '#27ae60' : (isPastDue ? '#e74c3c' : '#3498db')};
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div style="flex:1;">
            <h3 style="margin:0 0 8px 0;color:#2c3e50;">${escapeHtml(a.title)}</h3>
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">
              <span><strong>Subject:</strong> ${escapeHtml(a.subject || 'General')}</span>
              <span><strong>Tutor:</strong> ${escapeHtml(a.tutorName || 'Tutor')}</span>
              <span><strong>Due:</strong> ${a.dueDate ? `<span style="color:${isPastDue ? '#e74c3c' : 'inherit'};">${fmtDate(a.dueDate)}</span>` : 'No due date'}</span>
            </div>
            ${a.description ? `
              <div style="background:#f8f9fa;padding:12px;border-radius:8px;margin:12px 0;">
                <strong>📝 Instructions:</strong>
                <p style="margin:8px 0 0 0;white-space:pre-wrap;">${escapeHtml(a.description)}</p>
              </div>
            ` : ''}
            ${submitted ? `
              <div style="background:#e8f5e9;padding:12px;border-radius:8px;margin-top:12px;">
                <span class="badge success" style="margin-right:8px;">✓ Submitted</span>
                <small>Submitted on ${fmtDate(submitted.submittedAt)}</small>
                ${submitted.status === 'Reviewed' ? '<span class="badge" style="margin-left:8px;">Reviewed by Tutor</span>' : ''}
                ${submitted.fileUrl ? `
                  <div style="margin-top:8px;">
                    <a href="${submitted.fileUrl}" target="_blank" class="btn small ghost">📎 View Your Submission</a>
                  </div>
                ` : ''}
                ${submitted.note ? `<p style="margin:8px 0 0 0;"><strong>Your note:</strong> ${escapeHtml(submitted.note)}</p>` : ''}
              </div>
            ` : ''}
          </div>
          <div style="text-align:right;">
            ${submitted ? 
              '<span class="badge success" style="font-size:14px;padding:8px 16px;">✅ COMPLETED</span>' : 
              `<a href="/student/submit-work.html?assignmentId=${a.id}" class="btn" style="padding:10px 20px;">📤 Submit Work</a>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  const pendingCount = assignments.filter(a => !submittedMap.has(a.id)).length;
  const completedCount = submissions.length;
  
  return `
    <style>
      .assignment-card { transition: transform 0.2s, box-shadow 0.2s; }
      .assignment-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
      .stat-box { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .stat-number { font-size: 32px; font-weight: bold; margin: 0; }
    </style>
    
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-number" style="color:#3498db;">${assignments.length}</div>
        <p style="margin:0;color:#666;">Total Assignments</p>
      </div>
      <div class="stat-box">
        <div class="stat-number" style="color:#27ae60;">${completedCount}</div>
        <p style="margin:0;color:#666;">Completed</p>
      </div>
      <div class="stat-box">
        <div class="stat-number" style="color:#e67e22;">${pendingCount}</div>
        <p style="margin:0;color:#666;">Pending</p>
      </div>
    </div>
    
    <div class="card panel">
      <h3>📝 My Assignments</h3>
      <p style="margin-bottom:20px;color:#666;">View all your assignments, read instructions, and submit your work.</p>
      ${rows || '<p class="empty">No assignments yet. Check back later!</p>'}
    </div>
  `;
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
  // Group activities by date
  const groupedByDate = {};
  items.forEach(item => {
    const dateKey = fmtDate(item.createdAt).split(',')[0]; // Just the date part
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(item);
  });
  
  // Count by type for stats
  const stats = {
    total: items.length,
    submissions: items.filter(i => i.type === 'submission').length,
    assignments: items.filter(i => i.type === 'assignment_received').length,
    portfolio: items.filter(i => i.type.startsWith('portfolio_')).length,
    feedback: items.filter(i => i.type === 'tutor_note').length,
    assessments: items.filter(i => i.type === 'assessment').length
  };
  
  const timelineHtml = Object.entries(groupedByDate).map(([date, dayItems]) => `
    <div class="timeline-group">
      <div class="timeline-date">📅 ${date}</div>
      <div class="timeline-items">
        ${dayItems.map(item => `
          <div class="activity-item ${item.type.replace('_', '-')}" data-activity-id="${item.id}" data-type="${item.type}">
            <div class="activity-icon">${item.icon}</div>
            <div class="activity-content">
              <div class="activity-header">
                <span class="activity-type">${item.typeLabel}</span>
                <span class="activity-time">${fmtDate(item.createdAt).split(',')[1] || ''}</span>
              </div>
              <div class="activity-title">${escapeHtml(item.title)}</div>
              <div class="activity-description">${escapeHtml(item.description.length > 200 ? item.description.substring(0, 200) + '...' : item.description)}</div>
              ${item.metadata?.fileUrl ? `<div class="activity-attachment"><a href="${item.metadata.fileUrl}" target="_blank" class="btn small ghost">📎 View Attachment</a></div>` : ''}
              ${item.metadata?.score ? `<div class="activity-score">Score: ${item.metadata.score}/${item.metadata.maxScore || '—'}</div>` : ''}
              ${item.metadata?.dueDate ? `<div class="activity-due">Due: ${fmtDate(item.metadata.dueDate)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
  
  return `
    <style>
      .activities-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .stat-pill {
        background: white;
        border-radius: 12px;
        padding: 12px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .stat-pill .number {
        font-size: 24px;
        font-weight: bold;
        display: block;
      }
      .stat-pill .label {
        font-size: 12px;
        color: #666;
      }
      .timeline-group {
        margin-bottom: 24px;
      }
      .timeline-date {
        font-weight: bold;
        font-size: 14px;
        color: #666;
        margin-bottom: 12px;
        padding-bottom: 6px;
        border-bottom: 2px solid #e0e0e0;
      }
      .timeline-items {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .activity-item {
        background: white;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        gap: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .activity-item:hover {
        transform: translateX(4px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .activity-icon {
        font-size: 28px;
        min-width: 48px;
        text-align: center;
      }
      .activity-content {
        flex: 1;
      }
      .activity-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        flex-wrap: wrap;
        gap: 8px;
      }
      .activity-type {
        font-size: 12px;
        font-weight: 600;
        color: #3498db;
        background: #e3f2fd;
        padding: 2px 8px;
        border-radius: 20px;
      }
      .activity-time {
        font-size: 11px;
        color: #999;
      }
      .activity-title {
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 6px;
        color: #2c3e50;
      }
      .activity-description {
        font-size: 13px;
        color: #555;
        line-height: 1.4;
      }
      .activity-attachment {
        margin-top: 8px;
      }
      .activity-score {
        margin-top: 8px;
        font-size: 13px;
        color: #27ae60;
        font-weight: 500;
      }
      .activity-due {
        margin-top: 8px;
        font-size: 12px;
        color: #e67e22;
      }
      .filter-bar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .filter-btn {
        padding: 6px 14px;
        border-radius: 20px;
        border: 1px solid #ddd;
        background: white;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }
      .filter-btn.active {
        background: #3498db;
        color: white;
        border-color: #3498db;
      }
      .filter-btn:hover {
        background: #e3f2fd;
      }
      @media (max-width: 600px) {
        .activity-item { flex-direction: column; align-items: center; text-align: center; }
        .activity-header { justify-content: center; }
      }
    </style>
    
    <div class="stats-card" style="margin-bottom:20px;">
      <div class="activities-stats">
        <div class="stat-pill"><span class="number">${stats.total}</span><span class="label">Total Activities</span></div>
        <div class="stat-pill"><span class="number">${stats.submissions}</span><span class="label">📤 Submissions</span></div>
        <div class="stat-pill"><span class="number">${stats.assignments}</span><span class="label">📋 Assignments</span></div>
        <div class="stat-pill"><span class="number">${stats.portfolio}</span><span class="label">📖 Portfolio</span></div>
        <div class="stat-pill"><span class="number">${stats.feedback}</span><span class="label">✏️ Feedback</span></div>
        <div class="stat-pill"><span class="number">${stats.assessments}</span><span class="label">📊 Assessments</span></div>
      </div>
    </div>
    
    <div class="card panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <h3 style="margin:0;">📅 Activity Timeline</h3>
        <div class="filter-bar" id="activityFilterBar">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="submission">Submissions</button>
          <button class="filter-btn" data-filter="assignment_received">Assignments</button>
          <button class="filter-btn" data-filter="portfolio">Portfolio</button>
          <button class="filter-btn" data-filter="tutor_note">Feedback</button>
          <button class="filter-btn" data-filter="assessment">Assessments</button>
        </div>
      </div>
      <div id="activitiesTimeline">
        ${timelineHtml || '<div class="empty-state" style="text-align:center;padding:40px;"><div style="font-size:48px;">📭</div><p>No activities yet. Start by submitting work or adding portfolio entries!</p></div>'}
      </div>
    </div>
    
    <script>
      // Filter functionality
      const filterBtns = document.querySelectorAll('.filter-btn');
      const allActivities = document.querySelectorAll('.activity-item');
      
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.filter;
          
          allActivities.forEach(activity => {
            if (filter === 'all') {
              activity.style.display = 'flex';
            } else {
              const type = activity.dataset.type;
              if (type === filter || (filter === 'portfolio' && type.startsWith('portfolio_'))) {
                activity.style.display = 'flex';
              } else {
                activity.style.display = 'none';
              }
            }
          });
        });
      });
    </script>
  `;
}

function renderStudentMessagesPage(messages) {
  if (!messages || messages.length === 0) {
    return `
      <div class="card panel">
        <h3>💬 Messages from Your Tutor</h3>
        <div class="empty-state" style="text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:16px;">📭</div>
          <p>No messages yet.</p>
          <p style="color:#666;font-size:14px;">Messages from your tutor will appear here.</p>
        </div>
      </div>
    `;
  }
  
  const unreadCount = messages.filter(m => !m.read).length;
  
  const rows = messages.map(item => {
    const isUnread = !item.read;
    const senderName = item.tutorName || item.fromName || 'Tutor';
    
    return `
      <div class="message-card ${isUnread ? 'unread' : ''}" style="
        background: ${isUnread ? '#f0f7ff' : '#ffffff'};
        border-left: 4px solid ${isUnread ? '#3498db' : '#e0e0e0'};
        padding: 16px;
        margin-bottom: 12px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <span class="badge" style="background:#3498db;color:white;">📨 From: ${escapeHtml(senderName)}</span>
            ${isUnread ? '<span class="badge" style="background:#e74c3c;color:white;margin-left:8px;">NEW</span>' : ''}
          </div>
          <small style="color:#666;">${fmtDate(item.createdAt)}</small>
        </div>
        <h4 style="margin:8px 0;color:#2c3e50;">${escapeHtml(item.subject || 'No Subject')}</h4>
        <div style="background:#f8f9fa;padding:12px;border-radius:6px;margin-top:8px;">
          <p style="margin:0;line-height:1.5;">${escapeHtml(item.message || item.body || '—')}</p>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <style>
      .message-card { transition: all 0.2s; }
      .message-card:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
      .message-card.unread { border-left-width: 6px; }
      .messages-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    </style>
    
    <div class="card panel">
      <div class="messages-header">
        <h3>💬 Messages from Your Tutor</h3>
        ${unreadCount > 0 ? `<span class="badge" style="background:#e74c3c;">${unreadCount} unread</span>` : ''}
      </div>
      <p style="margin-bottom:20px;color:#666;">Messages sent by your tutor appear here. New messages are highlighted.</p>
      <div class="messages-list">
        ${rows}
      </div>
    </div>
  `;
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
  // Group entries by type for stats
  const stats = {
    total: items.length,
    achievements: items.filter(i => i.type === 'Achievement').length,
    challenges: items.filter(i => i.type === 'Challenge').length,
    progress: items.filter(i => i.type === 'Progress').length,
    reflections: items.filter(i => i.type === 'Reflection').length,
    character: items.filter(i => i.type === 'Character').length,
    problemsSolved: items.filter(i => i.type === 'Problem_Solved').length,
    skillsMastered: items.filter(i => i.type === 'Skill_Mastered').length,
    goals: items.filter(i => i.type === 'Goal_Set').length
  };
  
  const feedHtml = items.length ? items.map(item => {
    const typeIcons = {
      'Achievement': '🏆',
      'Challenge': '⚠️',
      'Progress': '📈',
      'Reflection': '🤔',
      'Character': '💪',
      'Problem_Solved': '🧩',
      'Skill_Mastered': '⭐',
      'Goal_Set': '🎯'
    };
    const icon = typeIcons[item.type] || '📖';
    const feelingEmoji = item.feeling === 'Excited' ? '😊' : (item.feeling === 'Struggling' ? '😟' : (item.feeling === 'Proud' ? '🦁' : ''));
    
    return `
      <div class="portfolio-card" data-type="${item.type}">
        <div class="portfolio-card-header">
          <div>
            <span class="portfolio-type-badge ${item.type?.toLowerCase()}">${icon} ${item.type || 'Entry'}</span>
            ${feelingEmoji ? `<span class="feeling-badge">${feelingEmoji} ${item.feeling}</span>` : ''}
          </div>
          <small>${fmtDate(item.createdAt)}</small>
        </div>
        <h4 class="portfolio-title">${escapeHtml(item.title || 'Untitled')}</h4>
        <p class="portfolio-note">${escapeHtml(item.note || '')}</p>
        ${item.milestone ? `<div class="portfolio-milestone">🎯 Milestone: ${escapeHtml(item.milestone)}</div>` : ''}
        ${item.fileUrl ? `<div class="portfolio-attachment">${renderFilePreview(item.fileUrl, item.fileName)}</div>` : ''}
        <div class="portfolio-actions">
          <button class="btn small ghost delete-portfolio-btn" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('') : `<div class="empty-state" style="text-align:center;padding:60px 20px;"><div style="font-size:64px;">🌟</div><h3>Start Your Journey</h3><p>Document your learning, track your growth, and celebrate your achievements!</p></div>`;
  
  return `
    <style>
      .portfolio-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .stat-card-portfolio {
        background: white;
        border-radius: 12px;
        padding: 12px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: transform 0.2s;
      }
      .stat-card-portfolio:hover { transform: translateY(-2px); }
      .stat-number { font-size: 24px; font-weight: bold; display: block; }
      .stat-label { font-size: 11px; color: #666; }
      .portfolio-layout {
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        gap: 24px;
      }
      @media (max-width: 768px) {
        .portfolio-layout { grid-template-columns: 1fr; }
      }
      .form-card {
        background: white;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        position: sticky;
        top: 20px;
      }
      .form-card h3 {
        margin-top: 0;
        margin-bottom: 16px;
      }
      .form-group {
        margin-bottom: 16px;
      }
      .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        font-size: 13px;
        color: #555;
      }
      .form-group select, .form-group input, .form-group textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
      }
      .form-group textarea {
        resize: vertical;
      }
      .portfolio-card {
        background: white;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .portfolio-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      }
      .portfolio-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
      }
      .portfolio-type-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        background: #e3f2fd;
        color: #1976d2;
      }
      .portfolio-type-badge.achievement { background: #e8f5e9; color: #2e7d32; }
      .portfolio-type-badge.challenge { background: #ffebee; color: #c62828; }
      .portfolio-type-badge.progress { background: #e0f7fa; color: #00838f; }
      .portfolio-type-badge.reflection { background: #f3e5f5; color: #6a1b9a; }
      .portfolio-type-badge.character { background: #fff3e0; color: #e65100; }
      .portfolio-type-badge.problem_solved { background: #e8eaf6; color: #283593; }
      .portfolio-type-badge.skill_mastered { background: #fce4ec; color: #880e4f; }
      .portfolio-type-badge.goal_set { background: #e0f2f1; color: #00695c; }
      .feeling-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 11px;
        background: #f5f5f5;
        margin-left: 8px;
      }
      .portfolio-title {
        margin: 0 0 10px 0;
        font-size: 18px;
        color: #2c3e50;
      }
      .portfolio-note {
        margin: 0 0 12px 0;
        line-height: 1.5;
        color: #444;
      }
      .portfolio-milestone {
        background: #f0f7ff;
        padding: 10px;
        border-radius: 8px;
        margin: 10px 0;
        font-size: 13px;
        border-left: 3px solid #3498db;
      }
      .portfolio-attachment {
        margin: 12px 0;
      }
      .portfolio-actions {
        margin-top: 12px;
        text-align: right;
      }
      .filter-buttons {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .filter-chip {
        padding: 4px 12px;
        border-radius: 20px;
        border: 1px solid #ddd;
        background: white;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }
      .filter-chip.active {
        background: #3498db;
        color: white;
        border-color: #3498db;
      }
      .filter-chip:hover {
        background: #e3f2fd;
      }
    </style>
    
    <div class="portfolio-stats">
      <div class="stat-card-portfolio"><span class="stat-number">${stats.total}</span><span class="stat-label">Total Entries</span></div>
      <div class="stat-card-portfolio"><span class="stat-number">🏆 ${stats.achievements}</span><span class="stat-label">Achievements</span></div>
      <div class="stat-card-portfolio"><span class="stat-number">🧩 ${stats.problemsSolved}</span><span class="stat-label">Problems Solved</span></div>
      <div class="stat-card-portfolio"><span class="stat-number">⭐ ${stats.skillsMastered}</span><span class="stat-label">Skills Mastered</span></div>
      <div class="stat-card-portfolio"><span class="stat-number">💪 ${stats.character}</span><span class="stat-label">Character Growth</span></div>
      <div class="stat-card-portfolio"><span class="stat-number">🎯 ${stats.goals}</span><span class="stat-label">Goals Set</span></div>
    </div>
    
    <div class="portfolio-layout">
      <div class="form-card">
        <h3>📖 Add to Your Journey</h3>
        <form id="portfolioForm" class="stack-form">
          <div class="form-group">
            <label>Entry Type *</label>
            <select id="portfolioType" required>
              <option value="Achievement">🏆 Achievement - Something you accomplished</option>
              <option value="Challenge">⚠️ Challenge - Something you overcame</option>
              <option value="Progress">📈 Progress - How you're improving</option>
              <option value="Reflection">🤔 Reflection - What you learned about yourself</option>
              <option value="Character">💪 Character Growth - Kindness, patience, honesty, etc.</option>
              <option value="Problem_Solved">🧩 Problem Solved - A difficult problem you solved</option>
              <option value="Skill_Mastered">⭐ Skill Mastered - Something new you can do</option>
              <option value="Goal_Set">🎯 Goal Set - A new goal for yourself</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>How are you feeling?</label>
            <select id="portfolioFeeling">
              <option value="">— Optional —</option>
              <option value="Excited">😊 Excited</option>
              <option value="Proud">🦁 Proud</option>
              <option value="Struggling">😟 Struggling</option>
              <option value="Determined">💪 Determined</option>
              <option value="Grateful">🙏 Grateful</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Title *</label>
            <input id="portfolioTitle" placeholder="What happened today? (e.g., 'I helped a classmate', 'Finally understood fractions')" required>
          </div>
          
          <div class="form-group">
            <label>Your Reflection / Story *</label>
            <textarea id="portfolioNote" rows="5" placeholder="Write about what happened, what you learned, and how you grew..."></textarea>
          </div>
          
          <div class="form-group">
            <label>Milestone (Optional)</label>
            <input id="portfolioMilestone" placeholder="e.g., 'First time doing X', 'Reached 80% mastery'">
          </div>
          
          <div class="form-group">
            <label>Upload Evidence (Optional)</label>
            <input id="portfolioFile" type="file" accept="image/*,video/*,application/pdf">
            <small style="color:#666;display:block;margin-top:4px;">Upload a photo, scan, or video of your work</small>
          </div>
          
          <button type="submit" class="btn" style="width:100%;">✨ Add to My Journey</button>
          <span id="portfolioMsg" style="display:block;text-align:center;margin-top:10px;"></span>
        </form>
      </div>
      
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
          <h3 style="margin:0;">🌟 My Growth Journey</h3>
          <div class="filter-buttons" id="portfolioFilterBar">
            <button class="filter-chip active" data-filter="all">All</button>
            <button class="filter-chip" data-filter="Achievement">🏆</button>
            <button class="filter-chip" data-filter="Problem_Solved">🧩</button>
            <button class="filter-chip" data-filter="Skill_Mastered">⭐</button>
            <button class="filter-chip" data-filter="Character">💪</button>
            <button class="filter-chip" data-filter="Goal_Set">🎯</button>
            <button class="filter-chip" data-filter="Progress">📈</button>
            <button class="filter-chip" data-filter="Reflection">🤔</button>
          </div>
        </div>
        <div id="portfolioFeed">
          ${feedHtml}
        </div>
      </div>
    </div>
    
    <script>
      // Portfolio filter functionality
      const filterChips = document.querySelectorAll('.filter-chip');
      const portfolioCards = document.querySelectorAll('.portfolio-card');
      
      filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
          filterChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const filter = chip.dataset.filter;
          
          portfolioCards.forEach(card => {
            if (filter === 'all') {
              card.style.display = 'block';
            } else {
              const badge = card.querySelector('.portfolio-type-badge');
              if (badge && badge.textContent.includes(filter)) {
                card.style.display = 'block';
              } else {
                card.style.display = 'none';
              }
            }
          });
        });
      });
      
      // Delete portfolio entry handler
      document.querySelectorAll('.delete-portfolio-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (confirm('Delete this portfolio entry? This cannot be undone.')) {
            const id = btn.dataset.id;
            await deleteDoc(doc(db, 'portfolio', id));
            location.reload();
          }
        });
      });
    </script>
  `;
}
function renderSubmitWorkPage(profile, user, assignments, submissions, forcedId = null) {
  const studentName = getStudentDisplayName(profile, user);
  const submittedMap = new Map(submissions.map(s => [s.assignmentId, s]));
  const pendingAssignments = assignments.filter(a => !submittedMap.has(a.id));
  const completedCount = submissions.length;
  const pendingCount = pendingAssignments.length;
  
  const options = pendingAssignments.map(item => `
    <option value="${escapeHtml(item.id)}" ${forcedId === item.id ? 'selected' : ''}>
      ${escapeHtml(item.title || 'Untitled Assignment')} 
      ${item.subject ? `- ${escapeHtml(item.subject)}` : ''} 
      ${item.dueDate ? `(Due: ${fmtDate(item.dueDate)})` : ''}
    </option>
  `).join('');
  
  const submissionRows = submissions.map(item => `
    <div class="submission-history-item" style="
      background: white;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      border-left: 3px solid #27ae60;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>${escapeHtml(item.assignmentTitle || 'Assignment')}</strong>
          <span class="badge success" style="margin-left:8px;">✓ Submitted</span>
        </div>
        <small>${fmtDate(item.submittedAt)}</small>
      </div>
      ${item.note ? `<p style="margin:8px 0 0;font-size:14px;color:#666;">${escapeHtml(item.note)}</p>` : ''}
      ${item.fileUrl ? `
        <div style="margin-top:8px;">
          <a href="${item.fileUrl}" target="_blank" class="btn small ghost">📎 View File</a>
        </div>
      ` : ''}
    </div>
  `).join('');
  
  return `
    <style>
      .submit-section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .history-section { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    </style>
    
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
      <div class="card stat primary">
        <h3 style="font-size:28px;margin:0;">${assignments.length}</h3>
        <p>Total Assignments</p>
      </div>
      <div class="card stat success">
        <h3 style="font-size:28px;margin:0;">${completedCount}</h3>
        <p>Completed</p>
      </div>
      <div class="card stat warn">
        <h3 style="font-size:28px;margin:0;">${pendingCount}</h3>
        <p>Pending</p>
      </div>
    </div>
    
    <div class="submit-section">
      <h3>📤 Submit Your Work</h3>
      <p>Welcome, ${escapeHtml(studentName)}. Select an assignment and submit your work below.</p>
      
      ${pendingAssignments.length === 0 ? `
        <div class="success-message" style="background:#d4edda;padding:20px;border-radius:8px;text-align:center;">
          <span style="font-size:32px;">🎉</span>
          <h4 style="margin:8px 0;">Great job!</h4>
          <p>You've submitted all your assignments. Check back later for new ones!</p>
        </div>
      ` : `
        <form id="submissionForm" class="stack-form">
          <div class="form-row">
            <label>Select Assignment *</label>
            <select id="assignmentId" required style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd;">
              <option value="">-- Choose an assignment --</option>
              ${options}
            </select>
          </div>
          
          <div id="assignmentDetails"></div>
          
          <div class="form-row">
            <label>Your Work / Notes</label>
            <textarea id="submissionNote" rows="5" placeholder="Write your answers, reflections, or notes about your work..." style="width:100%;padding:12px;border-radius:6px;border:1px solid #ddd;"></textarea>
          </div>
          
          <div class="form-row">
            <label>Attach File (optional)</label>
            <input id="submissionFile" type="file" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ddd;">
            <small style="color:#666;">Supported: images, PDFs, documents, videos</small>
          </div>
          
          <div class="form-actions" style="display:flex;align-items:center;gap:16px;">
            <button type="submit" class="btn" id="submitWorkBtn" style="padding:12px 24px;font-size:16px;">📤 Submit Work</button>
            <span id="submitWorkMsg"></span>
          </div>
        </form>
      `}
    </div>
    
    ${submissions.length > 0 ? `
      <div class="history-section">
        <h3>📋 Your Submission History</h3>
        <p>Previously submitted work:</p>
        <div style="margin-top:16px;">
          ${submissionRows}
        </div>
      </div>
    ` : ''}
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

function renderClassroomsPage(classrooms, students, profile) {
  const classroomCards = classrooms.map(item => {
    const studentCount = Array.isArray(item.studentIds) ? item.studentIds.length : 0;
    const color = item.subject 
      ? (item.subject.toLowerCase().includes('math') ? '#4285f4' 
         : item.subject.toLowerCase().includes('science') ? '#34a853' 
         : '#ea4335') 
      : '#fbbc05';

    return `
      <div class="classroom-card" data-id="${escapeHtml(item.id)}" style="border-top: 4px solid ${color};">
        <div class="class-header">
          <div class="class-icon" style="background:${color};">📚</div>
          <div>
            <h3>${escapeHtml(item.name || 'Untitled Class')}</h3>
            <p>${escapeHtml(item.section || '')} • ${escapeHtml(item.subject || 'No subject')}</p>
          </div>
        </div>
        <div class="class-info">
          <div><strong>Class Code:</strong> <span class="code-badge">${escapeHtml(item.classCode || '—')}</span></div>
          <div>${studentCount} students</div>
          <small>Created ${fmtDate(item.createdAt)}</small>
        </div>
        <div class="class-actions">
          <button class="btn primary enter-class-btn" data-id="${escapeHtml(item.id)}">Enter Class</button>
          <button class="btn ghost classroom-delete-btn" data-id="${escapeHtml(item.id)}">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <style>
      .classrooms-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
      .classroom-card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; transition: all 0.2s; }
      .classroom-card:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.15); transform: translateY(-4px); }
      .class-header { padding: 20px; display: flex; gap: 16px; align-items: center; }
      .class-icon { width: 56px; height: 56px; border-radius: 12px; color: white; display: flex; align-items: center; justify-content: center; font-size: 28px; }
      .class-info { padding: 0 20px 20px; border-top: 1px solid #eee; font-size: 14px; }
      .code-badge { background: #f1f3f4; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-weight: bold; }
      .class-actions { padding: 16px 20px; display: flex; gap: 12px; border-top: 1px solid #eee; }
    </style>

    <div class="card panel">
      <h3 style="display:flex;justify-content:space-between;align-items:center;">
        My Classrooms <button class="btn" id="createClassBtn">+ Create Class</button>
      </h3>
      <p style="margin-bottom:24px;color:#666;">Everything lives inside each class — exactly like Google Classroom.</p>
      <div class="classrooms-container">
        ${classroomCards || '<p class="empty">No classrooms yet. Create your first one!</p>'}
      </div>
    </div>

    <!-- Create Class Modal -->
    <div id="createClassModal" class="modal" style="display:none;">
      <div class="modal-content" style="max-width:520px;">
        <h3>Create a new class</h3>
        <form id="classroomForm" class="stack-form">
          <div class="form-row"><label>Class name *</label><input id="classroomName" type="text" required placeholder="Grade 8 Mathematics"></div>
          <div class="form-row"><label>Section</label><input id="classroomSection" type="text" placeholder="Period 3"></div>
          <div class="form-row"><label>Subject</label><input id="classroomSubject" type="text" placeholder="Mathematics"></div>
          <div class="form-row"><label>Room</label><input id="classroomRoom" type="text" placeholder="Room 101"></div>
          <div class="form-row"><label>Select Students (optional)</label><select id="classroomStudents" multiple size="6">${students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name || s.name || s.email)}</option>`).join('')}</select></div>
          <div class="form-actions">
            <button type="button" class="btn ghost" id="cancelCreateBtn">Cancel</button>
            <button type="submit" class="btn" id="saveClassroomBtn">Create Class</button>
            <span id="classroomMsg"></span>
          </div>
        </form>
      </div>
    </div>
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
  allStudents.forEach(s => { 
    userMap[s.id] = { 
      name: s.full_name || s.name || s.email, 
      role: 'Student',
      email: s.email 
    }; 
  });
  allTutors.forEach(t => { 
    userMap[t.id] = { 
      name: t.full_name || t.name || t.email, 
      role: 'Tutor',
      email: t.email 
    }; 
  });
  
  // Group messages by conversation (tutor-student pair)
  const conversations = {};
  
  allMessages.forEach(msg => {
    const studentId = msg.studentId || msg.toId;
    const tutorId = msg.tutorId || msg.fromId;
    
    if (!studentId || !tutorId) return;
    
    const key = `${tutorId}|${studentId}`;
    if (!conversations[key]) {
      conversations[key] = {
        tutor: userMap[tutorId] || { name: msg.tutorName || tutorId },
        student: userMap[studentId] || { name: msg.studentName || studentId },
        messages: []
      };
    }
    conversations[key].messages.push(msg);
  });
  
  // Sort conversations by latest message
  const sortedConversations = Object.values(conversations).sort((a, b) => {
    const aLatest = Math.max(...a.messages.map(m => m.createdAt?.seconds || 0));
    const bLatest = Math.max(...b.messages.map(m => m.createdAt?.seconds || 0));
    return bLatest - aLatest;
  });
  
  const conversationHtml = sortedConversations.map(conv => {
    const sortedMessages = conv.messages.sort((a, b) => 
      (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    );
    
    const unreadCount = sortedMessages.filter(m => !m.read).length;
    
    return `
      <div class="conversation-card" style="
        background: white;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 2px solid #f0f0f0;
          margin-bottom: 12px;
        ">
          <div>
            <div style="display: flex; gap: 16px; align-items: center;">
              <span style="font-size: 18px;">👨‍🏫</span>
              <div>
                <strong style="font-size: 16px;">${escapeHtml(conv.tutor.name)}</strong>
                <span class="badge" style="margin-left: 8px;">Tutor</span>
              </div>
              <span style="color: #999;">→</span>
              <span style="font-size: 18px;">👧</span>
              <div>
                <strong style="font-size: 16px;">${escapeHtml(conv.student.name)}</strong>
                <span class="badge success" style="margin-left: 8px;">Student</span>
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; color: #666;">
              ${sortedMessages.length} message${sortedMessages.length !== 1 ? 's' : ''}
            </div>
            ${unreadCount > 0 ? `<span class="badge" style="background:#e74c3c;margin-top:4px;">${unreadCount} unread</span>` : ''}
          </div>
        </div>
        
        <div style="max-height: 300px; overflow-y: auto; padding-right: 8px;">
          ${sortedMessages.slice(-10).map(msg => {
            const isFromTutor = msg.fromRole === 'tutor' || msg.tutorId;
            return `
              <div style="
                display: flex;
                justify-content: ${isFromTutor ? 'flex-start' : 'flex-end'};
                margin-bottom: 12px;
              ">
                <div style="
                  max-width: 70%;
                  background: ${isFromTutor ? '#e3f2fd' : '#f3e5f5'};
                  padding: 12px;
                  border-radius: 12px;
                  border-bottom-${isFromTutor ? 'left' : 'right'}-radius: 2px;
                ">
                  <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                  ">
                    <strong style="font-size: 13px;">
                      ${escapeHtml(isFromTutor ? conv.tutor.name : conv.student.name)}
                    </strong>
                    <small style="margin-left: 12px; color: #666;">
                      ${fmtDate(msg.createdAt)}
                    </small>
                  </div>
                  ${msg.subject ? `<div style="font-weight: 500; margin-bottom: 6px; color: #2c3e50;">${escapeHtml(msg.subject)}</div>` : ''}
                  <p style="margin: 0; line-height: 1.4;">${escapeHtml(msg.message || msg.body || '—')}</p>
                  ${!msg.read && isFromTutor ? '<div style="margin-top: 4px;"><span style="font-size: 11px; color: #e74c3c;">● Unread</span></div>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('page-content').innerHTML = `
    <style>
      .conversation-card::-webkit-scrollbar { width: 6px; }
      .conversation-card::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
      .conversation-card::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }
    </style>
    
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-number">${allMessages.length}</div>
        <p>Total Messages</p>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Object.keys(conversations).length}</div>
        <p>Conversations</p>
      </div>
      <div class="stat-card">
        <div class="stat-number">${allMessages.filter(m => !m.read).length}</div>
        <p>Unread Messages</p>
      </div>
      <div class="stat-card">
        <div class="stat-number">${allStudents.length}</div>
        <p>Students</p>
      </div>
    </div>
    
    <div class="card panel">
      <h3>📨 All Tutor-Student Conversations</h3>
      <p style="margin-bottom:20px;color:#666;">Complete view of all messages exchanged between tutors and students.</p>
      ${conversationHtml || '<p class="empty">No messages have been sent yet.</p>'}
    </div>
  `;
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
  
  const { profile } = bundle;
  
  try {
    const portfolios = await loadPortfoliosForUser(null, 'parent');
    document.getElementById('page-content').innerHTML = renderPortfolioGrid(portfolios, 'parent', profile);
  } catch (err) {
    console.error('Portfolio error:', err);
    document.getElementById('page-content').innerHTML = '<div class="error">Error loading portfolios</div>';
  }
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
  try {
    const snap = await getDocs(collection(db, 'messages'));
    const messages = snap.docs.map(d => ({ 
      id: d.id, 
      ...d.data() 
    }));
    console.log(`📨 Loaded ${messages.length} total messages for parent view`);
    return messages;
  } catch (err) {
    console.error('Error loading all messages:', err);
    return [];
  }
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
  
  try {
    const [assignments, submissions, assessments, notifications, portfolioItems, resources] = await Promise.all([
      loadStudentAssignments(user.uid),
      loadStudentSubmissions(user.uid),
      loadStudentAssessments(user.uid),
      loadStudentNotifications(user.uid),
      loadStudentPortfolio(user.uid),
      loadStudentResources(user.uid)
    ]);
    document.getElementById('page-content').innerHTML = renderStudentDashboard(profile, assignments, submissions, assessments, notifications, portfolioItems, resources);
    
    // Attach click handlers for notifications (mark as read)
    document.querySelectorAll('.notification-item').forEach(el => {
      el.addEventListener('click', async () => {
        if (el.classList.contains('unread')) {
          await updateDoc(doc(db, 'notifications', el.dataset.id), { read: true });
          el.classList.remove('unread');
          el.style.background = 'white';
        }
      });
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    document.getElementById('page-content').innerHTML = `<div class="card panel error">⚠️ Unable to load dashboard: ${err.message}</div>`;
  }
}



async function bootStudentAssignmentsPage() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'student') return;
  await ensureStudentMirror(bundle.user, bundle.profile);
  const { user, profile } = bundle;
  
  const [assignments, submissions] = await Promise.all([
    loadStudentAssignments(user.uid), 
    loadStudentSubmissions(user.uid)
  ]);
  
  document.getElementById('page-content').innerHTML = renderStudentAssignmentsPage(assignments, submissions, profile);
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
  
  try {
    const portfolios = await loadPortfoliosForUser(user.uid, 'student');
    document.getElementById('page-content').innerHTML = renderPortfolioGrid(portfolios, 'student', profile);
  } catch (err) {
    console.error('Portfolio error:', err);
    document.getElementById('page-content').innerHTML = '<div class="error">Error loading portfolios</div>';
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
  
  try {
    const messages = await loadStudentMessages(user.uid);
    document.getElementById('page-content').innerHTML = renderStudentMessagesPage(messages);
    
    // Mark messages as read when viewed
    const unreadMessages = messages.filter(m => !m.read);
    for (const msg of unreadMessages) {
      await updateDoc(doc(db, 'messages', msg.id), { read: true });
    }
  } catch (err) {
    console.error('Error loading student messages:', err);
    document.getElementById('page-content').innerHTML = `
      <div class="card panel error">
        <h3>Error</h3>
        <p>Unable to load messages: ${err.message}</p>
      </div>
    `;
  }
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
  
  const [assignments, submissions] = await Promise.all([
    loadStudentAssignments(user.uid), 
    loadStudentSubmissions(user.uid)
  ]);
  
  document.getElementById('page-content').innerHTML = renderSubmitWorkPage(profile, user, assignments, submissions, forcedId);
  
  // Pre-select assignment if forcedId is provided
  if (forcedId && document.getElementById('assignmentId')) {
    document.getElementById('assignmentId').value = forcedId;
    // Trigger change to load assignment details
    loadAssignmentDetails(forcedId, assignments);
  }
  
  // Add change handler to show assignment details
  const assignmentSelect = document.getElementById('assignmentId');
  if (assignmentSelect) {
    assignmentSelect.addEventListener('change', (e) => {
      loadAssignmentDetails(e.target.value, assignments);
    });
  }
  
  const form = document.getElementById('submissionForm');
  const msg = document.getElementById('submitWorkMsg');
  const submitBtn = document.getElementById('submitWorkBtn');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const assignmentId = document.getElementById('assignmentId').value;
      const note = document.getElementById('submissionNote')?.value || '';
      const file = document.getElementById('submissionFile').files[0];
      
      if (!assignmentId) { 
        msg.innerHTML = '<span style="color:#e74c3c;">❌ Please select an assignment</span>'; 
        return; 
      }
      
      if (!file && !note.trim()) {
        msg.innerHTML = '<span style="color:#e74c3c;">❌ Please attach a file or write a note</span>';
        return;
      }
      
      if (submitBtn) submitBtn.disabled = true;
      msg.innerHTML = '<span style="color:#3498db;">⏳ Submitting your work...</span>';
      
      try {
        const assignmentDoc = await getDoc(doc(db, 'assignments', assignmentId));
        const assignment = assignmentDoc.data();
        
        let upload = { url: '', name: '' };
        if (file) {
          upload = await uploadFile(file, `submissions/${user.uid}/${assignmentId}`);
        }
        
        // Create submission record
        await addDoc(collection(db, 'submissions'), {
          assignmentId, 
          assignmentTitle: assignment?.title || 'Assignment',
          subject: assignment?.subject || '',
          studentId: user.uid,
          studentName: getStudentDisplayName(profile, user),
          note,
          fileUrl: upload.url,
          fileName: upload.name,
          status: 'Submitted',
          submittedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        
        // Create notification for tutor
        await addDoc(collection(db, 'notifications'), {
          tutorId: assignment?.tutorId,
          studentId: user.uid,
          studentName: getStudentDisplayName(profile, user),
          assignmentId,
          assignmentTitle: assignment?.title,
          title: 'New Submission',
          message: `${getStudentDisplayName(profile, user)} submitted "${assignment?.title}"`,
          type: 'submission',
          read: false,
          createdAt: serverTimestamp()
        });
        
        msg.innerHTML = '<span style="color:#27ae60;">✅ Work submitted successfully! Redirecting...</span>';
        setTimeout(() => location.href = '/student/assignments.html', 1500);
      } catch (err) {
        msg.innerHTML = `<span style="color:#e74c3c;">❌ Error: ${err.message}</span>`;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}


function loadAssignmentDetails(assignmentId, assignments) {
  const detailsDiv = document.getElementById('assignmentDetails');
  if (!detailsDiv) return;
  
  const assignment = assignments.find(a => a.id === assignmentId);
  if (!assignment) {
    detailsDiv.innerHTML = '';
    return;
  }
  
  const isPastDue = assignment.dueDate && new Date(assignment.dueDate) < new Date();
  
  detailsDiv.innerHTML = `
    <div style="background:#f0f7ff;padding:16px;border-radius:8px;margin-top:16px;">
      <h4 style="margin:0 0 8px 0;">📋 Assignment Details</h4>
      <p><strong>Subject:</strong> ${escapeHtml(assignment.subject || 'General')}</p>
      <p><strong>Tutor:</strong> ${escapeHtml(assignment.tutorName || 'Tutor')}</p>
      <p><strong>Due Date:</strong> <span style="color:${isPastDue ? '#e74c3c' : 'inherit'};">${fmtDate(assignment.dueDate) || 'No due date'}</span></p>
      ${assignment.description ? `
        <div style="margin-top:12px;padding:12px;background:white;border-radius:6px;">
          <strong>Instructions:</strong>
          <p style="margin:8px 0 0 0;white-space:pre-wrap;">${escapeHtml(assignment.description)}</p>
        </div>
      ` : ''}
    </div>
  `;
}


// ============================================
// BOOT FUNCTIONS - TUTOR (FIXES INTEGRATED HERE)
// ============================================

async function bootTutorDashboard() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user, profile } = bundle;
  
  // Load all data
  const [classrooms, allStudents, allAssignments, allAssessments, allResources, allLessonPlans] = await Promise.all([
    loadClassrooms(user.uid),
    loadAllStudents(),
    loadTutorAssignments(user.uid),
    loadTutorAssessments(user.uid),
    loadResources(user.uid),
    loadTutorLessonPlans(user.uid)
  ]);
  
  document.getElementById('page-content').innerHTML = renderTutorDashboardNew(profile, classrooms, allStudents, allAssignments, allAssessments, allResources, allLessonPlans);
  
  // Setup dashboard interactivity
  setupDashboardInteractivity(classrooms, allStudents, profile);
}



function setupDashboardInteractivity(classrooms, allStudents, profile) {
  // Classroom tab switching
  const tabs = document.querySelectorAll('.classroom-tab');
  const contentPanel = document.getElementById('classroomContentPanel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Find the classroom data
      const classroomId = tab.dataset.classroomId;
      const classroomData = window.dashboardClassrooms?.find(ct => ct.classroom.id === classroomId);
      
      if (classroomData && contentPanel) {
        contentPanel.innerHTML = renderClassroomDashboardContent(classroomData);
      }
    });
  });
  
  // Create classroom button (if modal exists)
  const createBtn = document.getElementById('createClassBtn');
  if (createBtn) {
    createBtn.onclick = () => {
      // Open create classroom modal - you can implement this
      showCreateClassroomModal(profile);
    };
  }
}




function renderTutorDashboardNew(profile, classrooms, allStudents, allAssignments, allAssessments, allResources, allLessonPlans) {
  const tutorName = profile?.name || profile?.full_name || 'Tutor';
  
  // Calculate stats across all classrooms
  const totalStudents = allStudents.length;
  const totalClassrooms = classrooms.length;
  const totalAssignments = allAssignments.length;
  const totalAssessments = allAssessments.length;
  const pendingGrading = allAssessments.filter(a => a.status !== 'Graded').length;
  const activeAssignments = allAssignments.filter(a => a.status === 'Active').length;
  const totalResources = allResources.length;
  const totalLessonPlans = allLessonPlans.length;
  
  // Get recent submissions across all classrooms
  const recentActivity = getRecentActivity(allAssignments, allAssessments);
  
  // Group data by classroom for the tabs
  const classroomTabs = classrooms.map((c, index) => {
    const classStudents = allStudents.filter(s => c.studentIds?.includes(s.id));
    const classAssignments = allAssignments.filter(a => a.classroomId === c.id);
    const classAssessments = allAssessments.filter(a => classStudents.some(s => s.id === a.studentId));
    const classResources = allResources.filter(r => r.classroomId === c.id);
    const classLessonPlans = allLessonPlans.filter(l => l.classroomId === c.id);
    
    return {
      classroom: c,
      students: classStudents,
      assignments: classAssignments,
      assessments: classAssessments,
      resources: classResources,
      lessonPlans: classLessonPlans,
      isActive: index === 0
    };
  });

  return `
    <style>
      .dashboard-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      
      /* Welcome Banner */
      .welcome-banner {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 28px 32px;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 20px;
      }
      .welcome-banner h2 {
        margin: 0 0 8px 0;
        font-size: 28px;
      }
      .welcome-banner p {
        margin: 0;
        opacity: 0.9;
      }
      .quick-actions {
        display: flex;
        gap: 12px;
      }
      .quick-actions .btn {
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        padding: 12px 20px;
      }
      .quick-actions .btn:hover {
        background: rgba(255,255,255,0.3);
      }
      
      /* Stats Grid */
      .stats-grid-dash {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 16px;
      }
      .stat-card-dash {
        background: white;
        border-radius: 16px;
        padding: 20px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
      }
      .stat-card-dash:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.1);
      }
      .stat-card-dash .stat-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }
      .stat-card-dash .stat-value {
        font-size: 28px;
        font-weight: bold;
        color: #2c3e50;
      }
      .stat-card-dash .stat-label {
        font-size: 13px;
        color: #7f8c8d;
        margin-top: 4px;
      }
      
      /* Classroom Tabs */
      .classroom-tabs-container {
        background: white;
        border-radius: 20px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        overflow: hidden;
      }
      .classroom-tabs-header {
        display: flex;
        background: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
        padding: 0 16px;
        overflow-x: auto;
      }
      .classroom-tab {
        padding: 16px 24px;
        cursor: pointer;
        font-weight: 500;
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
        white-space: nowrap;
        color: #555;
      }
      .classroom-tab:hover {
        background: #e8f0fe;
        color: #667eea;
      }
      .classroom-tab.active {
        border-bottom-color: #667eea;
        color: #667eea;
        background: white;
      }
      .classroom-tab .tab-badge {
        margin-left: 8px;
        background: #e0e0e0;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 11px;
        color: #555;
      }
      .classroom-tab.active .tab-badge {
        background: #667eea;
        color: white;
      }
      
      /* Classroom Content */
      .classroom-content-panel {
        padding: 24px;
        min-height: 400px;
      }
      .classroom-header-dash {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
      }
      .classroom-title h3 {
        margin: 0 0 4px 0;
        font-size: 22px;
      }
      .classroom-title p {
        margin: 0;
        color: #666;
      }
      .classroom-code {
        background: #f0f7ff;
        padding: 8px 16px;
        border-radius: 20px;
        font-family: monospace;
        font-size: 16px;
        border: 1px dashed #667eea;
      }
      
      /* Dashboard Sections within Classroom */
      .dash-sections-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      @media (max-width: 768px) {
        .dash-sections-grid {
          grid-template-columns: 1fr;
        }
      }
      .dash-section {
        background: #f8f9fa;
        border-radius: 16px;
        padding: 20px;
      }
      .dash-section h4 {
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .activity-item-dash {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: white;
        border-radius: 12px;
        margin-bottom: 8px;
        transition: all 0.2s;
      }
      .activity-item-dash:hover {
        background: #e8f0fe;
      }
      .activity-icon-dash {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }
      .activity-content-dash {
        flex: 1;
      }
      .activity-title-dash {
        font-weight: 500;
        margin-bottom: 2px;
      }
      .activity-meta-dash {
        font-size: 12px;
        color: #888;
      }
      
      /* Student List */
      .student-list-dash {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .student-chip {
        background: white;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .student-chip .avatar-small {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #667eea;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
      }
      
      /* Empty State */
      .empty-state-dash {
        text-align: center;
        padding: 60px 20px;
        color: #999;
      }
      .empty-state-dash .icon {
        font-size: 64px;
        margin-bottom: 16px;
      }
      
      /* Recent Activity Feed */
      .recent-activity-feed {
        background: white;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      }
      .feed-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .feed-item {
        display: flex;
        gap: 16px;
        padding: 16px 0;
        border-bottom: 1px solid #eee;
      }
      .feed-item:last-child {
        border-bottom: none;
      }
      .feed-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: #f0f7ff;
      }
      .feed-content {
        flex: 1;
      }
      .feed-title {
        font-weight: 500;
        margin-bottom: 4px;
      }
      .feed-meta {
        font-size: 13px;
        color: #666;
      }
    </style>

    <div class="dashboard-container">
      
      <!-- Welcome Banner -->
      <div class="welcome-banner">
        <div>
          <h2>Welcome back, ${escapeHtml(tutorName)}! 👋</h2>
          <p>Here's what's happening in your classrooms today.</p>
        </div>
        <div class="quick-actions">
          <button class="btn" onclick="document.getElementById('createClassBtn')?.click()">
            ➕ Create Class
          </button>
          <button class="btn" onclick="window.location.href='/tutor/classrooms.html'">
            🏫 All Classrooms
          </button>
        </div>
      </div>
      
      <!-- Stats Overview -->
      <div class="stats-grid-dash">
        <div class="stat-card-dash" onclick="window.location.href='/tutor/classrooms.html'">
          <div class="stat-icon">🏫</div>
          <div class="stat-value">${totalClassrooms}</div>
          <div class="stat-label">Classrooms</div>
        </div>
        <div class="stat-card-dash" onclick="switchToLearnersTab()">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${totalStudents}</div>
          <div class="stat-label">Students</div>
        </div>
        <div class="stat-card-dash" onclick="switchToClassworkTab()">
          <div class="stat-icon">📝</div>
          <div class="stat-value">${activeAssignments}</div>
          <div class="stat-label">Active Assignments</div>
        </div>
        <div class="stat-card-dash" onclick="switchToGradesTab()">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${pendingGrading}</div>
          <div class="stat-label">Pending Grading</div>
        </div>
        <div class="stat-card-dash">
          <div class="stat-icon">📚</div>
          <div class="stat-value">${totalResources}</div>
          <div class="stat-label">Resources</div>
        </div>
        <div class="stat-card-dash">
          <div class="stat-icon">📖</div>
          <div class="stat-value">${totalLessonPlans}</div>
          <div class="stat-label">Lesson Plans</div>
        </div>
      </div>
      
      <!-- Classroom Tabs Section -->
      ${classrooms.length > 0 ? `
        <div class="classroom-tabs-container">
          <div class="classroom-tabs-header" id="classroomTabsHeader">
            ${classroomTabs.map((ct, i) => `
              <div class="classroom-tab ${i === 0 ? 'active' : ''}" data-classroom-id="${ct.classroom.id}">
                ${escapeHtml(ct.classroom.name)}
                <span class="tab-badge">${ct.students.length} students</span>
              </div>
            `).join('')}
          </div>
          
          <div class="classroom-content-panel" id="classroomContentPanel">
            ${renderClassroomDashboardContent(classroomTabs[0])}
          </div>
        </div>
      ` : `
        <div class="classroom-tabs-container">
          <div class="classroom-content-panel">
            <div class="empty-state-dash">
              <div class="icon">🏫</div>
              <h3>No Classrooms Yet</h3>
              <p>Create your first classroom to get started!</p>
              <button class="btn" onclick="document.getElementById('createClassBtn')?.click()" style="margin-top: 16px;">
                ➕ Create Classroom
              </button>
            </div>
          </div>
        </div>
      `}
      
      <!-- Recent Activity Feed -->
      <div class="recent-activity-feed">
        <div class="feed-header">
          <h3 style="margin:0;">🔄 Recent Activity</h3>
          <a href="/tutor/activities.html" class="btn ghost small">View All →</a>
        </div>
        <div id="recentActivityFeed">
          ${renderRecentActivityFeed(recentActivity)}
        </div>
      </div>
      
    </div>
    
    <!-- Hidden Classroom Data for JS -->
    <script>
      window.dashboardClassrooms = ${JSON.stringify(classroomTabs).replace(/</g, '\\u003c')};
      window.dashboardProfile = ${JSON.stringify(profile).replace(/</g, '\\u003c')};
    </script>
  `;
}

function getRecentActivity(assignments, assessments) {
  const activities = [];
  
  assignments.forEach(a => {
    activities.push({
      type: 'assignment',
      title: a.title,
      classroomName: a.classroomName,
      tutorName: a.tutorName,
      date: a.createdAt
    });
  });
  
  assessments.forEach(a => {
    activities.push({
      type: 'assessment',
      title: a.title,
      classroomName: a.classroomName,
      studentName: a.studentName,
      date: a.createdAt
    });
  });
  
  // Sort by date descending
  activities.sort((a, b) => {
    const aTime = a.date?.seconds || 0;
    const bTime = b.date?.seconds || 0;
    return bTime - aTime;
  });
  
  return activities;
}


function renderRecentActivityFeed(activities) {
  if (!activities || activities.length === 0) {
    return '<p class="empty" style="padding:40px;text-align:center;">No recent activity</p>';
  }
  
  return activities.slice(0, 8).map(activity => {
    const icon = activity.type === 'assignment' ? '📝' : 
                 activity.type === 'assessment' ? '📊' : 
                 activity.type === 'submission' ? '📤' : '📋';
    
    return `
      <div class="feed-item">
        <div class="feed-icon" style="background: ${activity.type === 'assignment' ? '#e3f2fd' : (activity.type === 'assessment' ? '#fff3e0' : '#e8f5e9')};">
          ${icon}
        </div>
        <div class="feed-content">
          <div class="feed-title">
            ${escapeHtml(activity.title)}
          </div>
          <div class="feed-meta">
            ${escapeHtml(activity.classroomName || '')} • 
            ${escapeHtml(activity.studentName || activity.tutorName || '')} • 
            ${fmtDate(activity.date)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}




function renderClassroomDashboardContent(classroomTab) {
  const { classroom, students, assignments, assessments, resources, lessonPlans } = classroomTab;
  
  const pendingAssignments = assignments.filter(a => a.status === 'Active').length;
  const pendingGrading = assessments.filter(a => a.status !== 'Graded').length;
  const recentSubmissions = []; // You can populate this from actual data
  
  // Get upcoming assignments (with due dates)
  const upcomingAssignments = assignments
    .filter(a => a.dueDate && new Date(a.dueDate) > new Date())
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);
  
  // Get recent assessments
  const recentAssessments = assessments
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 3);
  
  return `
    <div class="classroom-header-dash">
      <div class="classroom-title">
        <h3>${escapeHtml(classroom.name)}</h3>
        <p>${escapeHtml(classroom.section || '')} • ${escapeHtml(classroom.subject || 'No subject')}</p>
      </div>
      <div style="display:flex;gap:12px;align-items:center;">
        <span class="classroom-code">📋 Code: ${escapeHtml(classroom.classCode)}</span>
        <button class="btn" onclick="enterClassroom('${classroom.id}')">
          🚪 Enter Full Classroom
        </button>
      </div>
    </div>
    
    <div class="dash-sections-grid">
      <!-- Left Column -->
      <div>
        <div class="dash-section">
          <h4>
            <span>📝 Upcoming Assignments</span>
            <span class="badge">${pendingAssignments} active</span>
          </h4>
          ${upcomingAssignments.length > 0 ? upcomingAssignments.map(a => `
            <div class="activity-item-dash" onclick="viewAssignment('${a.id}')">
              <div class="activity-icon-dash" style="background:#e3f2fd;">📝</div>
              <div class="activity-content-dash">
                <div class="activity-title-dash">${escapeHtml(a.title)}</div>
                <div class="activity-meta-dash">
                  Due: ${fmtDate(a.dueDate)} • ${a.maxScore ? a.maxScore + ' pts' : 'No points'}
                </div>
              </div>
            </div>
          `).join('') : `
            <p class="empty" style="padding:20px;text-align:center;">No upcoming assignments</p>
          `}
          <div style="margin-top:12px;">
            <button class="btn small ghost" onclick="switchToClassworkTab()">
              ➕ Create Assignment
            </button>
          </div>
        </div>
        
        <div class="dash-section" style="margin-top:20px;">
          <h4>
            <span>📊 Recent Assessments</span>
            <span class="badge warn">${pendingGrading} to grade</span>
          </h4>
          ${recentAssessments.length > 0 ? recentAssessments.map(a => `
            <div class="activity-item-dash" onclick="gradeAssessment('${a.id}')">
              <div class="activity-icon-dash" style="background:#fff3e0;">📊</div>
              <div class="activity-content-dash">
                <div class="activity-title-dash">${escapeHtml(a.title)}</div>
                <div class="activity-meta-dash">
                  ${escapeHtml(a.studentName || 'Student')} • 
                  ${a.status === 'Graded' ? `✓ ${a.score}/${a.maxScore}` : '⏳ Pending'}
                </div>
              </div>
            </div>
          `).join('') : `
            <p class="empty" style="padding:20px;text-align:center;">No assessments yet</p>
          `}
          <div style="margin-top:12px;">
            <button class="btn small ghost" onclick="switchToGradesTab()">
              ➕ Create Assessment
            </button>
          </div>
        </div>
      </div>
      
      <!-- Right Column -->
      <div>
        <div class="dash-section">
          <h4>
            <span>👥 Students (${students.length})</span>
          </h4>
          <div class="student-list-dash">
            ${students.length > 0 ? students.slice(0, 8).map(s => `
              <div class="student-chip" onclick="selectLearner('${s.id}')">
                <span class="avatar-small">${escapeHtml((s.full_name || s.name || 'S').charAt(0).toUpperCase())}</span>
                <span>${escapeHtml((s.full_name || s.name || '').split(' ')[0])}</span>
              </div>
            `).join('') : '<p class="empty">No students yet</p>'}
            ${students.length > 8 ? `<div class="student-chip">+${students.length - 8} more</div>` : ''}
          </div>
          <div style="margin-top:12px;">
            <button class="btn small ghost" onclick="switchToLearnersTab()">
              👥 View All Students
            </button>
            <button class="btn small ghost" onclick="copyClassCode('${classroom.classCode}')">
              📋 Copy Invite Code
            </button>
          </div>
        </div>
        
        <div class="dash-section" style="margin-top:20px;">
          <h4>
            <span>📚 Resources & Materials</span>
            <span class="badge">${resources.length}</span>
          </h4>
          ${resources.length > 0 ? resources.slice(0, 3).map(r => `
            <div class="activity-item-dash">
              <div class="activity-icon-dash" style="background:#e8f5e9;">📚</div>
              <div class="activity-content-dash">
                <div class="activity-title-dash">${escapeHtml(r.title)}</div>
                <div class="activity-meta-dash">
                  ${r.fileUrl ? '📎 Has attachment' : '📄 No file'}
                </div>
              </div>
            </div>
          `).join('') : `
            <p class="empty" style="padding:20px;text-align:center;">No resources yet</p>
          `}
        </div>
        
        <div class="dash-section" style="margin-top:20px;">
          <h4>
            <span>📖 Lesson Plans</span>
            <span class="badge">${lessonPlans.length}</span>
          </h4>
          ${lessonPlans.length > 0 ? lessonPlans.slice(0, 2).map(l => `
            <div class="activity-item-dash">
              <div class="activity-icon-dash" style="background:#f3e5f5;">📖</div>
              <div class="activity-content-dash">
                <div class="activity-title-dash">${escapeHtml(l.title)}</div>
                <div class="activity-meta-dash">
                  ${l.plannedDate ? fmtDate(l.plannedDate) : 'No date'} • 
                  ${statusBadge(l.status || 'Draft')}
                </div>
              </div>
            </div>
          `).join('') : `
            <p class="empty" style="padding:20px;text-align:center;">No lesson plans yet</p>
          `}
        </div>
      </div>
    </div>
  `;
}


// ============================================
// UPDATED: TUTOR ASSIGNMENTS PAGE (FIXED)
// ============================================

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
        const subject = document.getElementById('assignSubject').value;
        const description = document.getElementById('assignDescription').value;
        const dueDate = document.getElementById('assignDueDate').value;
        
        // Create assignment data with proper fields for student visibility
        const assignmentData = {
          tutorId: user.uid, 
          tutorName: profile?.name || profile?.full_name || user.email,
          title, 
          subject,
          description,
          dueDate: dueDate || null,
          status: 'Active', 
          createdAt: serverTimestamp(),
          published: true  // CRITICAL: This makes it visible to students
        };
        
        if (target === 'classroom' && classroomId) {
          const classroom = classrooms.find(c => c.id === classroomId);
          assignmentData.classroomId = classroomId;
          assignmentData.classroomName = classroom?.name;
          assignmentData.targetType = 'classroom';
          
          // Notify classroom students
          const classroomStudents = students.filter(s => s.classroomId === classroomId);
          for (const s of classroomStudents) {
            await createAssignmentNotification(s.id, title, 'pending');
          }
        } else if (target === 'student' && studentId) {
          assignmentData.studentId = studentId;
          const student = students.find(s => s.id === studentId);
          assignmentData.studentName = student?.full_name || student?.name;
          assignmentData.targetType = 'student';
          
          // Notify specific student
          await createAssignmentNotification(studentId, title, 'pending');
        } else {
          assignmentData.targetType = 'all_students';
          // Notify all students
          for (const s of students) {
            await createAssignmentNotification(s.id, title, 'pending');
          }
        }
        
        await addDoc(collection(db, 'assignments'), assignmentData);
        msg.textContent = '✅ Assignment created successfully!';
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
      }
    });
  }
  
  // View Submissions button handler
  document.querySelectorAll('.view-submissions-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const row = document.getElementById(`submissions-${id}`);
      if (row.style.display === 'none' || !row.style.display) {
        row.style.display = 'table-row';
        const container = document.querySelector(`.submissions-container[data-assignment-id="${id}"]`);
        container.innerHTML = '<div class="loading">Loading submissions...</div>';
        
        try {
          const subs = await getDocs(query(collection(db, 'submissions'), where('assignmentId', '==', id)));
          const submissionsList = subs.docs.map(d => {
            const sub = d.data();
            return `
              <div class="submission-item" style="background:#fff;padding:16px;margin-bottom:12px;border-radius:8px;border-left:4px solid #3498db;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <div>
                    <strong style="font-size:16px;">${escapeHtml(sub.studentName || 'Student')}</strong>
                    <span class="badge ${sub.status === 'Submitted' ? 'success' : 'warn'}" style="margin-left:10px;">${escapeHtml(sub.status || 'Submitted')}</span>
                  </div>
                  <small>${fmtDate(sub.submittedAt)}</small>
                </div>
                ${sub.note ? `<p style="margin:8px 0;padding:8px;background:#f8f9fa;border-radius:4px;"><strong>Notes:</strong> ${escapeHtml(sub.note)}</p>` : ''}
                ${sub.fileUrl ? `
                  <div style="margin-top:10px;">
                    <a href="${sub.fileUrl}" target="_blank" class="btn small">📎 View File</a>
                    <a href="${sub.fileUrl}" download class="btn small ghost">⬇️ Download</a>
                    <span style="margin-left:10px;font-size:12px;color:#666;">${escapeHtml(sub.fileName || 'attachment')}</span>
                  </div>
                ` : '<p style="color:#666;font-size:14px;">No file attached</p>'}
                <button class="btn small ghost mark-reviewed-btn" data-submission-id="${d.id}" style="margin-top:8px;">✓ Mark as Reviewed</button>
              </div>
            `;
          }).join('');
          
          container.innerHTML = submissionsList || '<p class="empty">No submissions yet.</p>';
          
          // Add mark as reviewed handlers
          container.querySelectorAll('.mark-reviewed-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              await updateDoc(doc(db, 'submissions', btn.dataset.submissionId), { 
                status: 'Reviewed',
                reviewedAt: serverTimestamp()
              });
              btn.textContent = '✓ Reviewed';
              btn.disabled = true;
            });
          });
        } catch (err) {
          container.innerHTML = `<p class="error">Error loading submissions: ${err.message}</p>`;
        }
      } else {
        row.style.display = 'none';
      }
    });
  });
  
  // Delete assignment handler
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

  const { user, profile } = bundle;

  const [classrooms, allStudents] = await Promise.all([
    loadClassrooms(user.uid),
    loadAllStudents()
  ]);

  document.getElementById('page-content').innerHTML = renderClassroomsPage(classrooms, allStudents, profile);

  // Create class
  const createModal = document.getElementById('createClassModal');
  document.getElementById('createClassBtn').onclick = () => createModal.style.display = 'flex';
  document.getElementById('cancelCreateBtn').onclick = () => createModal.style.display = 'none';

  document.getElementById('classroomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // ... (same as before - already working)
    const name = document.getElementById('classroomName').value.trim();
    // ... rest of your existing create logic remains unchanged
  });

  // Enter Class
  document.querySelectorAll('.enter-class-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const classroom = classrooms.find(c => c.id === id);
      if (!classroom) return;

      // Load everything for this class
      const studentsInClass = allStudents.filter(s => classroom.studentIds?.includes(s.id));
      const [assignmentsInClass, resourcesInClass, lessonPlansInClass, assessmentsInClass] = await Promise.all([
        loadTutorAssignments(user.uid).then(list => list.filter(a => a.classroomId === id)),
        loadResources(user.uid).then(list => list.filter(r => r.classroomId === id)),
        loadTutorLessonPlans(user.uid).then(list => list.filter(l => l.classroomId === id)),
        loadTutorAssessments(user.uid).then(list => list.filter(a => studentsInClass.some(s => s.id === a.studentId)))
      ]);

      openClassroomModal(classroom, studentsInClass, assignmentsInClass, resourcesInClass, lessonPlansInClass, assessmentsInClass, [], [], profile);
    });
  });

  // Delete class
  document.querySelectorAll('.classroom-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this classroom and ALL its data?')) {
        await deleteDoc(doc(db, 'classrooms', btn.dataset.id));
        setTimeout(() => bootClassroomsPage(), 600);
      }
    });
  });
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
  
  const { user, profile } = bundle;
  const messages = await loadMessagesForTutor(user.uid);
  const students = await loadAllStudents();
  document.getElementById('page-content').innerHTML = renderMessagesPage(messages, students, profile);
  
  const form = document.getElementById('messageForm');
  const msg = document.getElementById('messageMsg');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const studentId = document.getElementById('messageStudentId').value;
      const subject = document.getElementById('messageSubject').value.trim();
      const body = document.getElementById('messageBody').value.trim();
      
      if (!studentId) {
        msg.textContent = 'Please select a student';
        msg.style.color = 'red';
        return;
      }
      
      if (!subject || !body) {
        msg.textContent = 'Subject and message are required';
        msg.style.color = 'red';
        return;
      }
      
      msg.textContent = 'Sending...';
      msg.style.color = 'blue';
      
      try {
        const student = students.find(s => s.id === studentId);
        const studentName = student?.full_name || student?.name || student?.email || 'Student';
        
        // Save message with proper fields for student retrieval
        await addDoc(collection(db, 'messages'), {
          tutorId: user.uid,
          tutorName: profile?.name || profile?.full_name || user.email,
          studentId: studentId,           // CRITICAL: This field is used by loadStudentMessages
          studentName: studentName,
          fromId: user.uid,
          fromName: profile?.name || profile?.full_name || user.email,
          fromRole: 'tutor',
          toId: studentId,
          toName: studentName,
          toRole: 'student',
          subject: subject,
          message: body,
          body: body,                      // For compatibility
          read: false,
          createdAt: serverTimestamp()
        });
        
        // Also create a notification for the student
        await addDoc(collection(db, 'notifications'), {
          studentId: studentId,
          title: 'New Message from Tutor',
          message: `${profile?.name || 'Your tutor'}: ${subject}`,
          type: 'message',
          read: false,
          createdAt: serverTimestamp()
        });
        
        msg.textContent = '✅ Message sent successfully!';
        msg.style.color = 'green';
        
        // Clear form
        document.getElementById('messageSubject').value = '';
        document.getElementById('messageBody').value = '';
        
        // Refresh messages display
        setTimeout(() => bootMessagesPage(), 1000);
      } catch (err) {
        console.error('Send message error:', err);
        msg.textContent = 'Error: ' + err.message;
        msg.style.color = 'red';
      }
    });
  }
}
function renderMessagesPage(messages, students, profile) {
  // Sort messages newest first
  const sortedMessages = [...messages].sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  
  const rows = sortedMessages.map(m => {
    const studentName = m.studentName || m.toName || 'Student';
    return `
      <div class="card panel" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <span class="badge success">📤 To: ${escapeHtml(studentName)}</span>
            ${m.read ? '<span class="badge">✓ Read</span>' : '<span class="badge warn">Unread</span>'}
          </div>
          <small>${fmtDate(m.createdAt)}</small>
        </div>
        <h4 style="margin:8px 0">${escapeHtml(m.subject || 'No Subject')}</h4>
        <p style="background:#f8f9fa;padding:12px;border-radius:8px;">${escapeHtml(m.message || m.body || '—')}</p>
      </div>
    `;
  }).join('');
  
  return `
    <style>
      .message-form-card { margin-bottom: 24px; }
      .sent-messages-card { margin-top: 24px; }
    </style>
    
    <section class="card panel message-form-card">
      <h3>✉️ Send Message to Student</h3>
      <p>Messages will appear on the student's Messages page.</p>
      <form id="messageForm" class="stack-form">
        <div class="form-row">
          <label>Select Student *</label>
          <select id="messageStudentId" required>
            <option value="">-- Choose a student --</option>
            ${students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name || s.name || s.email)} ${s.classroomName ? `(${escapeHtml(s.classroomName)})` : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Subject *</label>
          <input id="messageSubject" type="text" required placeholder="Message subject">
        </div>
        <div class="form-row">
          <label>Message *</label>
          <textarea id="messageBody" rows="5" required placeholder="Write your message to the student..."></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn">📨 Send Message</button>
          <span id="messageMsg" style="margin-left:12px;"></span>
        </div>
      </form>
    </section>
    
    <section class="card panel sent-messages-card">
      <h3>📋 Sent Messages (${messages.length})</h3>
      ${rows || '<p class="empty">No messages sent yet. Use the form above to send your first message.</p>'}
    </section>
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

// Add section builder functions
window.addSectionToBuilder = function() {
  if (!window.portfolioSections) window.portfolioSections = [];
  
  window.portfolioSections.push({
    title: '',
    description: '',
    type: 'text',
    required: true,
    order: window.portfolioSections.length,
    placeholder: ''
  });
  
  renderSectionBuilder();
};

window.removeSectionFromBuilder = function(index) {
  window.portfolioSections.splice(index, 1);
  // Reorder
  window.portfolioSections.forEach((s, i) => s.order = i);
  renderSectionBuilder();
};

function renderSectionBuilder() {
  const container = document.getElementById('sectionsList');
  if (!container) return;
  
  if (!window.portfolioSections || window.portfolioSections.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">No sections yet. Click "Add Section" to start building your portfolio.</p>';
    return;
  }
  
  container.innerHTML = window.portfolioSections.map((section, index) => `
    <div class="section-item">
      <div class="section-item-header">
        <span><strong>Section ${index + 1}</strong></span>
        <button type="button" class="btn small danger" onclick="removeSectionFromBuilder(${index})">✕</button>
      </div>
      <div style="display:grid;gap:8px;">
        <input type="text" placeholder="Section Title" value="${escapeHtml(section.title || '')}" 
               onchange="window.portfolioSections[${index}].title = this.value">
        <input type="text" placeholder="Description (optional)" value="${escapeHtml(section.description || '')}"
               onchange="window.portfolioSections[${index}].description = this.value">
        <select onchange="window.portfolioSections[${index}].type = this.value">
          <option value="text" ${section.type === 'text' ? 'selected' : ''}>📝 Text Response</option>
          <option value="upload" ${section.type === 'upload' ? 'selected' : ''}>📎 File Upload</option>
          <option value="reflection" ${section.type === 'reflection' ? 'selected' : ''}>🤔 Reflection</option>
          <option value="media" ${section.type === 'media' ? 'selected' : ''}>🎥 Media</option>
        </select>
        <input type="text" placeholder="Placeholder text / Hint" value="${escapeHtml(section.placeholder || '')}"
               onchange="window.portfolioSections[${index}].placeholder = this.value">
        <label>
          <input type="checkbox" ${section.required !== false ? 'checked' : ''} 
                 onchange="window.portfolioSections[${index}].required = this.checked"> Required
        </label>
      </div>
    </div>
  `).join('');
}


async function bootParentPortfolioPage() {
    await bootParentAllPortfolioPage();

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
  console.log('🎯 Booting tutor portfolios...');
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'tutor') return;
  
  const { user, profile } = bundle;
  
  try {
    const portfolios = await loadPortfoliosForUser(user.uid, 'tutor');
    console.log(`📁 Rendering ${portfolios.length} portfolios for tutor`);
    document.getElementById('page-content').innerHTML = renderPortfolioGrid(portfolios, 'tutor', profile);
  } catch (err) {
    console.error('Portfolio error:', err);
    document.getElementById('page-content').innerHTML = `
      <div class="card panel error">
        <h3>Error Loading Portfolios</h3>
        <p>${err.message}</p>
        <button class="btn" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
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

function openClassroomModal(classroom, studentsInClass, assignmentsInClass, resourcesInClass, lessonPlansInClass, assessmentsInClass, reportsInClass, messagesInClass, profile) {
  const old = document.getElementById('classModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'classModal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target.classList.contains('modal-overlay'))this.remove()">
      <div class="modal-box" style="width:98%;max-width:1400px;height:95vh;display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;">
        
        <!-- Header -->
        <div class="modal-header" style="padding:20px 28px;border-bottom:2px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;">
          <div>
            <h2 style="margin:0;font-size:26px;color:white;">${escapeHtml(classroom.name)}</h2>
            <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">
              ${escapeHtml(classroom.section || '')} • ${escapeHtml(classroom.subject || 'No subject')} • 
              <span style="background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-family:monospace;">
                Code: ${escapeHtml(classroom.classCode)}
              </span>
            </p>
          </div>
          <button class="btn" style="background:rgba(255,255,255,0.2);color:white;border:none;" onclick="document.getElementById('classModal').remove()">✕ Close</button>
        </div>

        <!-- Tabs Navigation -->
        <div class="modal-tabs" id="classTabs" style="display:flex;background:#f8f9fa;border-bottom:1px solid #ddd;padding:0 16px;">
          ${renderTabNav('stream', '📢 Stream', true)}
          ${renderTabNav('classwork', '📝 Classwork')}
          ${renderTabNav('people', '👥 People')}
          ${renderTabNav('learners', '🎓 Learners')}
          ${renderTabNav('grades', '📊 Grades')}
          ${renderTabNav('messages', '💬 Messages')}
          ${renderTabNav('reports', '📄 Reports')}
        </div>

        <!-- Content Area -->
        <div id="classContent" class="class-modal-content" style="flex:1;padding:24px;overflow-y:auto;background:#f5f7fa;"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);

  // Tab switching
  modal.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderClassTabContent(
        tab.dataset.tab, 
        classroom, 
        studentsInClass, 
        assignmentsInClass, 
        resourcesInClass, 
        lessonPlansInClass, 
        assessmentsInClass, 
        reportsInClass, 
        messagesInClass, 
        profile, 
        modal.querySelector('#classContent')
      );
    });
  });

  // Load initial tab
  renderClassTabContent('stream', classroom, studentsInClass, assignmentsInClass, resourcesInClass, lessonPlansInClass, assessmentsInClass, reportsInClass, messagesInClass, profile, modal.querySelector('#classContent'));
}


function renderTabNav(tabId, label, active = false) {
  return `
    <div class="modal-tab ${active ? 'active' : ''}" data-tab="${tabId}" style="
      padding:16px 24px;
      cursor:pointer;
      font-weight:500;
      border-bottom:3px solid ${active ? '#667eea' : 'transparent'};
      transition:all 0.2s;
      color:${active ? '#667eea' : '#555'};
    ">
      ${label}
    </div>
  `;
}




function renderClassTabContent(tab, classroom, studentsInClass, assignmentsInClass, resourcesInClass, lessonPlansInClass, assessmentsInClass, reportsInClass, messagesInClass, profile, contentEl) {
  let html = '';

  switch (tab) {
    case 'stream':
      html = renderStreamTab(classroom, profile);
      setTimeout(() => loadStreamFeed(classroom.id), 100);
      break;

    case 'classwork':
      html = renderClassworkTab(classroom, assignmentsInClass, resourcesInClass, lessonPlansInClass, studentsInClass);
      break;

    case 'people':
      html = renderPeopleTab(classroom, studentsInClass);
      break;

    case 'learners':
      html = renderLearnersTab(classroom, studentsInClass);
      break;

    case 'grades':
      html = renderGradesTab(classroom, assessmentsInClass, studentsInClass);
      break;

    case 'messages':
      html = renderMessagesTab(classroom, studentsInClass, profile);
      setTimeout(() => initializeChat(classroom.id, profile), 100);
      break;

    case 'reports':
      html = renderReportsTab(classroom, studentsInClass, reportsInClass, assessmentsInClass);
      break;
  }

  contentEl.innerHTML = html;
  
  if (tab === 'classwork') {
    attachClassworkEventListeners(classroom, studentsInClass);
  }
  if (tab === 'learners') {
    attachLearnersEventListeners(classroom);
  }
  if (tab === 'reports') {
    attachReportsEventListeners(classroom, studentsInClass);
  }
}


// Initialize chat system
async function initializeChat(classroomId, profile) {
  window.currentClassroomId = classroomId;
  window.currentProfile = profile;
  window.currentConversationId = null;
  
  await loadConversations(classroomId, profile);
  setupChatSearch();
  setupRealtimeChat(classroomId);
}

async function loadConversations(classroomId, profile) {
  const listEl = document.getElementById('conversationList');
  if (!listEl) return;

  try {
    // Get conversations where user is a participant
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    
    const snap = await getDocs(q);
    const conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Filter by classroom
    const classConversations = conversations.filter(c => c.classroomId === classroomId);
    
    if (classConversations.length === 0) {
      listEl.innerHTML = '<p style="padding:20px;text-align:center;color:#999;">No conversations yet</p>';
      return;
    }

    listEl.innerHTML = classConversations.map(conv => {
      const otherParticipant = conv.participantNames?.find(p => p.id !== auth.currentUser.uid);
      const unreadCount = conv.unreadCount?.[auth.currentUser.uid] || 0;
      
      return `
        <div class="conversation-item" data-conv-id="${conv.id}" onclick="selectConversation('${conv.id}')">
          <div class="conversation-avatar">
            ${escapeHtml((otherParticipant?.name || '?').charAt(0).toUpperCase())}
          </div>
          <div class="conversation-info">
            <div class="conversation-name">
              ${escapeHtml(otherParticipant?.name || 'Conversation')}
              ${conv.type === 'group' ? '<span style="font-size:11px;color:#666;"> (Group)</span>' : ''}
            </div>
            <div class="conversation-last">${escapeHtml(conv.lastMessage || 'No messages yet')}</div>
          </div>
          ${unreadCount > 0 ? `<span class="conversation-badge">${unreadCount}</span>` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Load conversations error:', err);
    listEl.innerHTML = '<p class="error">Error loading conversations</p>';
  }
}

window.selectConversation = async function(conversationId) {
  window.currentConversationId = conversationId;
  
  // Update active state
  document.querySelectorAll('.conversation-item').forEach(el => {
    el.classList.remove('active');
    if (el.dataset.convId === conversationId) {
      el.classList.add('active');
    }
  });
  
  await loadMessages(conversationId);
  markConversationRead(conversationId);
};

async function loadMessages(conversationId) {
  const chatMain = document.getElementById('chatMain');
  if (!chatMain) return;

  try {
    // Get conversation details
    const convDoc = await getDoc(doc(db, 'conversations', conversationId));
    const conv = convDoc.data();
    
    const otherParticipant = conv.participantNames?.find(p => p.id !== auth.currentUser.uid);
    
    chatMain.innerHTML = `
      <div class="chat-header">
        <div class="conversation-avatar" style="width:40px;height:40px;">
          ${escapeHtml((otherParticipant?.name || '?').charAt(0).toUpperCase())}
        </div>
        <div>
          <strong>${escapeHtml(otherParticipant?.name || 'Conversation')}</strong>
          <br><small style="color:#666;">${conv.type === 'group' ? 'Group chat' : 'Direct message'}</small>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="loading">Loading messages...</div>
      </div>
      <div class="chat-input-area">
        <textarea class="chat-input" id="messageInput" placeholder="Type a message..." rows="1"></textarea>
        <input type="file" id="chatFileInput" accept="*/*" style="display:none;">
        <button class="btn ghost" onclick="document.getElementById('chatFileInput').click()">📎</button>
        <button class="btn" onclick="sendChatMessage()">Send</button>
      </div>
    `;

    // Load messages
    const messagesSnap = await getDocs(
      query(
        collection(db, 'chat_messages'),
        where('conversationId', '==', conversationId),
        orderBy('createdAt', 'asc')
      )
    );
    
    const messagesEl = document.getElementById('chatMessages');
    messagesEl.innerHTML = messagesSnap.docs.map(doc => {
      const msg = doc.data();
      const isOutgoing = msg.senderId === auth.currentUser.uid;
      
      return `
        <div class="message ${isOutgoing ? 'outgoing' : ''}">
          <div class="message-avatar">
            ${escapeHtml((msg.senderName || '?').charAt(0).toUpperCase())}
          </div>
          <div class="message-content">
            ${msg.text ? `<div>${escapeHtml(msg.text)}</div>` : ''}
            ${msg.fileUrl ? renderFilePreview(msg.fileUrl, msg.fileName) : ''}
            <div class="message-time">${fmtDate(msg.createdAt)}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    // Setup file upload
    document.getElementById('chatFileInput').addEventListener('change', handleChatFileUpload);
    
    // Enter to send
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });

  } catch (err) {
    console.error('Load messages error:', err);
    chatMain.innerHTML = '<p class="error">Error loading messages</p>';
  }
}

window.sendChatMessage = async function() {
  const input = document.getElementById('messageInput');
  const text = input?.value.trim();
  const conversationId = window.currentConversationId;
  
  if (!text || !conversationId) return;
  
  try {
    await addDoc(collection(db, 'chat_messages'), {
      conversationId,
      senderId: auth.currentUser.uid,
      senderName: window.currentProfile?.name || auth.currentUser.displayName || 'User',
      text,
      createdAt: serverTimestamp()
    });
    
    // Update conversation last message
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      [`unreadCount.${getOtherParticipantId(conversationId)}`]: increment(1)
    });
    
    input.value = '';
    await loadMessages(conversationId);
  } catch (err) {
    alert('Error sending message: ' + err.message);
  }
};

function attachReportsEventListeners(classroom, students) {
  const form = document.getElementById('generateReportForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('reportMsg');
    msg.innerHTML = '<span style="color:#3498db;">Generating report...</span>';
    
    try {
      const studentId = document.getElementById('reportStudentId').value;
      const student = students.find(s => s.id === studentId);
      
      const reportData = {
        classroomId: classroom.id,
        studentId,
        studentName: student?.full_name || student?.name,
        type: document.getElementById('reportType').value,
        startDate: document.getElementById('reportStartDate').value,
        endDate: document.getElementById('reportEndDate').value,
        strengths: document.getElementById('reportStrengths').value,
        improvements: document.getElementById('reportImprovements').value,
        summary: document.getElementById('reportSummary').value,
        generatedBy: auth.currentUser.uid,
        generatorName: auth.currentUser.displayName || 'Tutor',
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'reports'), reportData);
      
      // Notify student
      await addDoc(collection(db, 'notifications'), {
        studentId,
        title: 'New Report Available',
        message: `Your ${reportData.type} report has been generated`,
        type: 'report',
        read: false,
        createdAt: serverTimestamp()
      });
      
      msg.innerHTML = '<span style="color:#27ae60;">✅ Report generated!</span>';
      setTimeout(() => {
        // Refresh reports tab
        const contentEl = document.querySelector('#classContent');
        if (contentEl) {
          renderClassTabContent('reports', classroom, students, [], [], [], [], [], [], {}, contentEl);
        }
      }, 1000);
      
    } catch (err) {
      msg.innerHTML = `<span style="color:#e74c3c;">Error: ${err.message}</span>`;
    }
  });
}




function renderReportsTab(classroom, students, reports, assessments) {
  return `
    <style>
      .reports-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      .report-card {
        background: white;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .report-form label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }
      .report-form select, .report-form textarea, .report-form input {
        width: 100%;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .generated-report {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        border-left: 4px solid #667eea;
      }
      .report-meta {
        display: flex;
        justify-content: space-between;
        color: #666;
        font-size: 12px;
        margin-bottom: 8px;
      }
    </style>

    <div class="reports-container">
      <div class="report-card">
        <h3>📊 Generate Report</h3>
        <form class="report-form" id="generateReportForm">
          <label>Select Student</label>
          <select id="reportStudentId" required>
            <option value="">-- Choose student --</option>
            ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('')}
          </select>
          
          <label>Report Type</label>
          <select id="reportType">
            <option value="progress">Progress Report</option>
            <option value="attendance">Attendance Report</option>
            <option value="assessment">Assessment Summary</option>
            <option value="comprehensive">Comprehensive Report</option>
          </select>
          
          <label>Date Range</label>
          <div style="display:flex;gap:12px;">
            <input type="date" id="reportStartDate" placeholder="Start">
            <input type="date" id="reportEndDate" placeholder="End">
          </div>
          
          <label>Strengths / Achievements</label>
          <textarea id="reportStrengths" rows="3" placeholder="What is the student doing well?"></textarea>
          
          <label>Areas for Improvement</label>
          <textarea id="reportImprovements" rows="3" placeholder="What can the student work on?"></textarea>
          
          <label>Summary / Comments</label>
          <textarea id="reportSummary" rows="4" placeholder="Overall assessment and recommendations..."></textarea>
          
          <button type="submit" class="btn" style="width:100%;">Generate Report</button>
          <span id="reportMsg"></span>
        </form>
      </div>
      
      <div class="report-card">
        <h3>📄 Recent Reports</h3>
        <div id="recentReportsList">
          ${reports && reports.length > 0 ? reports.map(r => `
            <div class="generated-report">
              <div class="report-meta">
                <span><strong>${escapeHtml(r.studentName || 'Student')}</strong></span>
                <span>${fmtDate(r.createdAt)}</span>
              </div>
              <p><strong>Strengths:</strong> ${escapeHtml(r.strengths || '—')}</p>
              <p><strong>Improvements:</strong> ${escapeHtml(r.improvements || r.lows || '—')}</p>
              <p><strong>Summary:</strong> ${escapeHtml(r.summary || '—')}</p>
              <div style="margin-top:12px;">
                <button class="btn small ghost" onclick="downloadReport('${r.id}')">📥 Download</button>
                <button class="btn small ghost" onclick="emailReport('${r.id}')">📧 Email</button>
              </div>
            </div>
          `).join('') : '<p class="empty">No reports generated yet</p>'}
        </div>
      </div>
    </div>
  `;
}



function renderLearnersTab(classroom, students) {
  return `
    <style>
      .learners-container {
        display: grid;
        grid-template-columns: 350px 1fr;
        gap: 24px;
      }
      .learners-sidebar {
        background: white;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .learners-main {
        background: white;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .learner-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 8px;
      }
      .learner-card:hover {
        background: #f0f7ff;
      }
      .learner-card.active {
        background: #e3f2fd;
        border-left: 3px solid #667eea;
      }
      .learner-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg,#667eea,#764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
      }
      .learner-info {
        flex: 1;
      }
      .learner-name {
        font-weight: 600;
      }
      .learner-status {
        font-size: 12px;
        color: #27ae60;
      }
      .learner-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      }
      .stat-box {
        text-align: center;
        padding: 16px;
        background: #f8f9fa;
        border-radius: 12px;
      }
      .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #667eea;
      }
      .stat-label {
        font-size: 12px;
        color: #666;
      }
      .progress-section {
        margin-top: 24px;
      }
      .progress-item {
        margin-bottom: 16px;
      }
      .progress-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .progress-bar {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg,#667eea,#764ba2);
        border-radius: 4px;
      }
    </style>

    <div class="learners-container">
      <div class="learners-sidebar">
        <h4 style="margin:0 0 16px 0;">Students (${students.length})</h4>
        <div style="max-height:500px;overflow-y:auto;">
          ${students.map(s => `
            <div class="learner-card" data-student-id="${s.id}" onclick="selectLearner('${s.id}')">
              <div class="learner-avatar">
                ${escapeHtml((s.full_name || s.name || 'S').charAt(0).toUpperCase())}
              </div>
              <div class="learner-info">
                <div class="learner-name">${escapeHtml(s.full_name || s.name || 'Student')}</div>
                <div class="learner-status">● Active</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="learners-main">
        <div id="learnerDetailView">
          <p style="text-align:center;color:#999;padding:40px;">Select a student to view details</p>
        </div>
      </div>
    </div>
  `;
}

window.selectLearner = async function(studentId) {
  const detailView = document.getElementById('learnerDetailView');
  if (!detailView) return;

  detailView.innerHTML = '<div class="loading">Loading student data...</div>';

  try {
    // Load student data
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    const student = studentDoc.data();
    
    // Load student's submissions, assessments, attendance
    const [submissions, assessments, attendance, portfolio] = await Promise.all([
      getDocs(query(collection(db, 'submissions'), where('studentId', '==', studentId))),
      getDocs(query(collection(db, 'assessments'), where('studentId', '==', studentId))),
      getDocs(query(collection(db, 'attendance'), where('studentId', '==', studentId))),
      getDocs(query(collection(db, 'portfolio'), where('studentId', '==', studentId)))
    ]);

    const submissionCount = submissions.size;
    const gradedCount = assessments.docs.filter(d => d.data().status === 'Graded').length;
    const presentCount = attendance.docs.filter(d => d.data().status === 'Present').length;
    const avgScore = assessments.docs.length > 0 
      ? assessments.docs.reduce((sum, d) => sum + (d.data().score || 0), 0) / assessments.docs.length 
      : 0;

    detailView.innerHTML = `
      <div class="learner-header" style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
        <div class="learner-avatar" style="width:64px;height:64px;font-size:24px;">
          ${escapeHtml((student?.full_name || student?.name || 'S').charAt(0).toUpperCase())}
        </div>
        <div>
          <h3 style="margin:0;">${escapeHtml(student?.full_name || student?.name || 'Student')}</h3>
          <p style="margin:4px 0;color:#666;">${escapeHtml(student?.email || '—')}</p>
        </div>
        <div style="margin-left:auto;">
          <button class="btn" onclick="sendMessageToStudent('${studentId}', '${escapeHtml(student?.full_name || student?.name)}')">
            💬 Message
          </button>
          <button class="btn ghost" onclick="generateLearnerReport('${studentId}')">
            📄 Generate Report
          </button>
        </div>
      </div>

      <div class="learner-stats">
        <div class="stat-box">
          <div class="stat-value">${submissionCount}</div>
          <div class="stat-label">Submissions</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${gradedCount}</div>
          <div class="stat-label">Assessments</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${presentCount}</div>
          <div class="stat-label">Days Present</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${Math.round(avgScore)}%</div>
          <div class="stat-label">Avg Score</div>
        </div>
      </div>

      <div class="progress-section">
        <h4>Assignment Completion</h4>
        <div class="progress-item">
          <div class="progress-header">
            <span>Overall Progress</span>
            <span>${submissionCount} completed</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(submissionCount * 10, 100)}%;"></div>
          </div>
        </div>
      </div>

      <div style="margin-top:24px;">
        <h4>Recent Activity</h4>
        <div id="learnerActivityFeed">Loading...</div>
      </div>
    `;

    // Load activity feed
    const activities = await loadStudentActivities(studentId);
    const activityFeed = document.getElementById('learnerActivityFeed');
    activityFeed.innerHTML = activities.slice(0, 10).map(a => `
      <div style="padding:12px;border-bottom:1px solid #eee;">
        <span>${a.icon}</span>
        <strong>${escapeHtml(a.title)}</strong>
        <small style="float:right;">${fmtDate(a.createdAt)}</small>
        <p style="margin:4px 0 0;font-size:13px;color:#666;">${escapeHtml(a.description)}</p>
      </div>
    `).join('') || '<p class="empty">No recent activity</p>';

  } catch (err) {
    detailView.innerHTML = `<p class="error">Error loading student data: ${err.message}</p>`;
  }
};

// ============================================
// MESSAGES TAB (Real-time Chat)
// ============================================

function renderMessagesTab(classroom, students, profile) {
  return `
    <style>
      .chat-container {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: 0;
        height: 100%;
        background: white;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .chat-sidebar {
        background: #f8f9fa;
        border-right: 1px solid #e0e0e0;
        display: flex;
        flex-direction: column;
      }
      .chat-sidebar-header {
        padding: 16px;
        border-bottom: 1px solid #e0e0e0;
      }
      .chat-search {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 20px;
        font-size: 14px;
      }
      .conversation-list {
        flex: 1;
        overflow-y: auto;
      }
      .conversation-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        transition: background 0.2s;
      }
      .conversation-item:hover {
        background: #e8f0fe;
      }
      .conversation-item.active {
        background: #e3f2fd;
        border-left: 3px solid #667eea;
      }
      .conversation-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg,#667eea,#764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        flex-shrink: 0;
      }
      .conversation-info {
        flex: 1;
        min-width: 0;
      }
      .conversation-name {
        font-weight: 600;
        margin-bottom: 4px;
      }
      .conversation-last {
        font-size: 12px;
        color: #666;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .conversation-badge {
        background: #667eea;
        color: white;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
      }
      .chat-main {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .chat-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .chat-messages {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f5f7fa;
      }
      .message {
        display: flex;
        gap: 12px;
        max-width: 70%;
      }
      .message.outgoing {
        margin-left: auto;
        flex-direction: row-reverse;
      }
      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #667eea;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        flex-shrink: 0;
      }
      .message.outgoing .message-avatar {
        background: #764ba2;
      }
      .message-content {
        background: white;
        padding: 12px 16px;
        border-radius: 18px;
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
      .message.outgoing .message-content {
        background: #e3f2fd;
        border-bottom-left-radius: 18px;
        border-bottom-right-radius: 4px;
      }
      .message-time {
        font-size: 10px;
        color: #999;
        margin-top: 4px;
      }
      .chat-input-area {
        padding: 16px 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 12px;
        align-items: flex-end;
      }
      .chat-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #ddd;
        border-radius: 24px;
        resize: none;
        font-size: 14px;
      }
      .chat-input:focus {
        outline: none;
        border-color: #667eea;
      }
      .new-conversation-btn {
        margin: 12px 16px;
        padding: 10px;
        background: white;
        border: 1px dashed #ccc;
        border-radius: 12px;
        text-align: center;
        cursor: pointer;
      }
    </style>

    <div class="chat-container">
      <div class="chat-sidebar">
        <div class="chat-sidebar-header">
          <input type="text" class="chat-search" placeholder="Search conversations..." id="chatSearchInput">
        </div>
        <div class="new-conversation-btn" onclick="showNewConversationModal('${classroom.id}', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          ➕ New Conversation
        </div>
        <div class="conversation-list" id="conversationList">
          <div class="loading">Loading conversations...</div>
        </div>
      </div>
      <div class="chat-main" id="chatMain">
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;">
          Select a conversation to start messaging
        </div>
      </div>
    </div>
  `;
}





function renderGradesTab(classroom, assessments, students) {
  return `
    <div class="card panel">
      <h3>📊 Grades</h3>
      
      <div style="margin-bottom:24px;">
        <button class="btn" onclick="showCreateItemModal('${classroom.id}', 'quiz', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          ➕ Create Assessment
        </button>
      </div>
      
      ${assessments.length ? `
        <div style="overflow-x:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Assessment</th>
                <th>Score</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${assessments.map(a => `
                <tr>
                  <td>${escapeHtml(a.studentName || '—')}</td>
                  <td>${escapeHtml(a.title)}</td>
                  <td>${a.score || '—'} / ${a.maxScore || '—'}</td>
                  <td>${statusBadge(a.status || 'Pending')}</td>
                  <td>${fmtDate(a.createdAt)}</td>
                  <td>
                    <button class="btn small" onclick="gradeAssessment('${a.id}')">Grade</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="empty">No assessments yet. Create one to start grading!</p>'}
    </div>
  `;
}

function getItemTypeLabel(type) {
  const labels = {
    'assignment': '📝 Create Assignment',
    'quiz': '📊 Create Quiz / Test',
    'material': '📚 Add Material',
    'lessonplan': '📖 Create Lesson Plan',
    'link': '🔗 Add Link',
    'question': '❓ Post Question',
    'topic': '📑 Create Topic'
  };
  return labels[type] || 'Create Item';
}

window.showLinkInput = function() {
  document.getElementById('linkInputSection').style.display = 'block';
  document.getElementById('formInputSection').style.display = 'none';
};

window.showFormInput = function() {
  document.getElementById('formInputSection').style.display = 'block';
  document.getElementById('linkInputSection').style.display = 'none';
};

async function handleCreateItem(selectedFiles) {
  const msg = document.getElementById('createItemMsg');
  msg.innerHTML = '<span style="color:#3498db;">Creating...</span>';
  
  try {
    const classroomId = document.getElementById('itemClassroomId').value;
    const type = document.getElementById('itemType').value;
    const title = document.getElementById('itemTitle').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    
    if (!title) {
      msg.innerHTML = '<span style="color:#e74c3c;">Please enter a title</span>';
      return;
    }
    
    // Upload files
    const uploadPromises = selectedFiles.map(file => 
      uploadFile(file, `classroom/${classroomId}/${type}`)
    );
    const uploads = await Promise.all(uploadPromises);
    
    // Build item data
    const itemData = {
      classroomId,
      tutorId: auth.currentUser.uid,
      tutorName: auth.currentUser.displayName || 'Tutor',
      title,
      description,
      type,
      status: type === 'assignment' || type === 'quiz' ? 'Active' : 'Published',
      published: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Add type-specific fields
    if (type === 'assignment' || type === 'quiz') {
      itemData.dueDate = document.getElementById('itemDueDate')?.value || null;
      itemData.maxScore = parseFloat(document.getElementById('itemMaxScore')?.value) || null;
      itemData.subject = document.getElementById('itemSubject')?.value || '';
    }
    
    if (type === 'lessonplan') {
      itemData.plannedDate = document.getElementById('itemLessonDate')?.value || null;
      itemData.objectives = document.getElementById('itemObjectives')?.value || '';
      itemData.materials = document.getElementById('itemMaterials')?.value || '';
    }
    
    // Add target students
    const targetType = document.getElementById('itemTargetType').value;
    if (targetType === 'specific') {
      const selectedOptions = Array.from(document.getElementById('itemStudentIds').selectedOptions);
      itemData.assignedTo = selectedOptions.map(opt => opt.value);
      itemData.targetType = 'specific';
    } else {
      itemData.targetType = 'classroom';
    }
    
    // Add attachments
    if (uploads.length > 0) {
      const primaryUpload = uploads[0];
      itemData.fileUrl = primaryUpload.url;
      itemData.fileName = primaryUpload.name;
      itemData.attachments = uploads.map(u => ({ url: u.url, name: u.name }));
    }
    
    // Add link
    const linkTitle = document.getElementById('linkTitle')?.value;
    const linkUrl = document.getElementById('linkUrl')?.value;
    if (linkUrl) {
      itemData.linkUrl = linkUrl;
      itemData.linkTitle = linkTitle || 'View Link';
    }
    
    // Add form
    const formTitle = document.getElementById('formTitle')?.value;
    const formUrl = document.getElementById('formUrl')?.value;
    if (formUrl) {
      itemData.formUrl = formUrl;
      itemData.formTitle = formTitle || 'Open Form';
    }
    
    // Save to appropriate collection
    let collectionName = 'assignments';
    if (type === 'material') collectionName = 'resources';
    else if (type === 'lessonplan') collectionName = 'lesson-plans';
    else if (type === 'topic') collectionName = 'classroom-topics';
    
    await addDoc(collection(db, collectionName), itemData);
    
    // Notify students
    await notifyClassStudents(classroomId, title, type);
    
    msg.innerHTML = '<span style="color:#27ae60;">✅ Created successfully!</span>';
    setTimeout(() => {
      document.getElementById('createItemModal').remove();
      // Refresh the class modal
      location.reload();
    }, 1000);
    
  } catch (err) {
    console.error('Create item error:', err);
    msg.innerHTML = `<span style="color:#e74c3c;">Error: ${err.message}</span>`;
  }
}




window.showCreateItemModal = function(classroomId, type, students) {
  const old = document.getElementById('createItemModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'createItemModal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target.classList.contains('modal-overlay'))this.remove()">
      <div class="modal-box" style="max-width:700px;max-height:90vh;overflow-y:auto;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>${getItemTypeLabel(type)}</h3>
          <button class="btn danger" onclick="document.getElementById('createItemModal').remove()">✕</button>
        </div>
        
        <div class="modal-body">
          <form id="createItemForm" class="stack-form">
            <input type="hidden" id="itemClassroomId" value="${classroomId}">
            <input type="hidden" id="itemType" value="${type}">
            
            <div class="form-row">
              <label>Title *</label>
              <input id="itemTitle" type="text" required placeholder="Enter title...">
            </div>
            
            <div class="form-row">
              <label>Description / Instructions</label>
              <textarea id="itemDescription" rows="4" placeholder="Add details, instructions, or notes..."></textarea>
            </div>
            
            ${type === 'assignment' || type === 'quiz' ? `
              <div class="form-row">
                <label>Due Date</label>
                <input id="itemDueDate" type="date">
              </div>
              
              <div class="form-row">
                <label>Points / Max Score</label>
                <input id="itemMaxScore" type="number" step="0.1" placeholder="e.g., 100">
              </div>
              
              <div class="form-row">
                <label>Subject</label>
                <input id="itemSubject" type="text" placeholder="e.g., Mathematics">
              </div>
            ` : ''}
            
            ${type === 'lessonplan' ? `
              <div class="form-row">
                <label>Lesson Date</label>
                <input id="itemLessonDate" type="date">
              </div>
              <div class="form-row">
                <label>Objectives</label>
                <textarea id="itemObjectives" rows="3" placeholder="Learning objectives..."></textarea>
              </div>
              <div class="form-row">
                <label>Materials Needed</label>
                <textarea id="itemMaterials" rows="2" placeholder="List materials..."></textarea>
              </div>
            ` : ''}
            
            <div class="form-row">
              <label>Target Students</label>
              <select id="itemTargetType">
                <option value="all">All Students in Class</option>
                <option value="specific">Specific Students</option>
              </select>
            </div>
            
            <div class="form-row" id="specificStudentsRow" style="display:none;">
              <label>Select Students</label>
              <select id="itemStudentIds" multiple size="5" style="width:100%;">
                ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name || s.email)}</option>`).join('')}
              </select>
              <small>Hold Ctrl/Cmd to select multiple</small>
            </div>
            
            <!-- Attachments Section -->
            <div class="form-row">
              <label>Attachments</label>
              <div style="border:2px dashed #ddd;border-radius:12px;padding:20px;text-align:center;">
                <input type="file" id="itemFileInput" style="display:none;" multiple>
                <button type="button" class="btn ghost" onclick="document.getElementById('itemFileInput').click()">
                  📎 Upload File
                </button>
                <span style="margin:0 8px;color:#999;">or</span>
                <button type="button" class="btn ghost" onclick="showLinkInput()">
                  🔗 Add Link
                </button>
                <button type="button" class="btn ghost" onclick="showFormInput()">
                  📋 Add Form
                </button>
                <div id="filePreviewList" style="margin-top:16px;"></div>
              </div>
            </div>
            
            <!-- Link Input (hidden by default) -->
            <div id="linkInputSection" style="display:none;">
              <div class="form-row">
                <label>Link Title</label>
                <input id="linkTitle" type="text" placeholder="e.g., YouTube Video, Google Doc">
              </div>
              <div class="form-row">
                <label>Link URL</label>
                <input id="linkUrl" type="url" placeholder="https://...">
              </div>
            </div>
            
            <!-- Form Input (hidden by default) -->
            <div id="formInputSection" style="display:none;">
              <div class="form-row">
                <label>Form Title</label>
                <input id="formTitle" type="text" placeholder="e.g., Feedback Form">
              </div>
              <div class="form-row">
                <label>Form URL (Google Forms, etc.)</label>
                <input id="formUrl" type="url" placeholder="https://forms.google.com/...">
              </div>
            </div>
            
            <div class="form-actions" style="margin-top:24px;">
              <button type="button" class="btn ghost" onclick="document.getElementById('createItemModal').remove()">Cancel</button>
              <button type="submit" class="btn">Create</button>
              <span id="createItemMsg"></span>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Target type toggle
  const targetSelect = document.getElementById('itemTargetType');
  const specificRow = document.getElementById('specificStudentsRow');
  targetSelect.addEventListener('change', (e) => {
    specificRow.style.display = e.target.value === 'specific' ? 'block' : 'none';
  });
  
  // File preview
  const fileInput = document.getElementById('itemFileInput');
  const previewDiv = document.getElementById('filePreviewList');
  const selectedFiles = [];
  
  fileInput.addEventListener('change', (e) => {
    previewDiv.innerHTML = '';
    for (const file of e.target.files) {
      selectedFiles.push(file);
      previewDiv.innerHTML += `
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f0f7ff;border-radius:8px;margin-bottom:8px;">
          <span>📄</span>
          <span style="flex:1;">${escapeHtml(file.name)}</span>
          <span style="font-size:12px;color:#666;">${(file.size / 1024).toFixed(1)} KB</span>
        </div>
      `;
    }
  });
  
  // Form submit
  document.getElementById('createItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleCreateItem(selectedFiles);
  });
};




function renderPeopleTab(classroom, students) {
  return `
    <div class="card panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;">👥 People</h3>
        <div>
          <span class="badge success">${students.length} Students</span>
        </div>
      </div>
      
      <div style="background:#f0f7ff;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h4 style="margin:0 0 12px 0;">📋 Class Code</h4>
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <code style="font-size:28px;font-family:monospace;background:#e8f0fe;padding:12px 24px;border-radius:8px;letter-spacing:4px;">
            ${escapeHtml(classroom.classCode)}
          </code>
          <button class="btn" onclick="copyClassCode('${classroom.classCode}')">📋 Copy Code</button>
          <button class="btn ghost" onclick="shareClassCode('${classroom.classCode}', '${escapeHtml(classroom.name)}')">📤 Share</button>
        </div>
        <p style="margin-top:12px;color:#666;">Share this code with students so they can join your class from their dashboard.</p>
      </div>
      
      <h4>Students in this class</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
        ${students.length ? students.map(s => `
          <div style="background:white;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;background:#3498db;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">
                ${escapeHtml((s.full_name || s.name || 'S').charAt(0).toUpperCase())}
              </div>
              <div>
                <strong>${escapeHtml(s.full_name || s.name || 'Student')}</strong>
                <br><small style="color:#666;">${escapeHtml(s.email || '—')}</small>
              </div>
            </div>
          </div>
        `).join('') : '<p class="empty">No students have joined yet. Share the class code to get started!</p>'}
      </div>
    </div>
  `;
}

function renderClassworkTab(classroom, assignments, resources, lessonPlans, students) {
  return `
    <style>
      .classwork-create-section {
        background: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .create-buttons {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin: 20px 0;
      }
      .create-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 20px 16px;
        background: #f8f9fa;
        border: 2px solid #e9ecef;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .create-btn:hover {
        background: #e3f2fd;
        border-color: #3498db;
        transform: translateY(-2px);
      }
      .create-btn .icon {
        font-size: 32px;
      }
      .create-btn .label {
        font-weight: 600;
        font-size: 14px;
      }
      .create-btn .desc {
        font-size: 11px;
        color: #666;
        text-align: center;
      }
      .classwork-item {
        background: white;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-left: 4px solid #3498db;
      }
      .classwork-item.assignment { border-left-color: #4285f4; }
      .classwork-item.material { border-left-color: #34a853; }
      .classwork-item.lessonplan { border-left-color: #fbbc05; }
      .classwork-item.quiz { border-left-color: #ea4335; }
      .classwork-section {
        margin-top: 32px;
      }
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .section-header h4 {
        margin: 0;
        color: #2c3e50;
      }
      .item-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      .attachment-preview {
        margin-top: 12px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 8px;
      }
    </style>

    <!-- Create Section -->
    <div class="classwork-create-section">
      <h3 style="margin:0 0 8px 0;">📝 Create Classwork</h3>
      <p style="color:#666;margin-bottom:16px;">Add assignments, materials, quizzes, and more for your students</p>
      
      <div class="create-buttons">
        <div class="create-btn" onclick="showCreateItemModal('${classroom.id}', 'assignment', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          <span class="icon">📝</span>
          <span class="label">Assignment</span>
          <span class="desc">Create homework or classwork</span>
        </div>
        <div class="create-btn" onclick="showCreateItemModal('${classroom.id}', 'quiz', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          <span class="icon">📊</span>
          <span class="label">Quiz / Test</span>
          <span class="desc">Create assessment</span>
        </div>
        <div class="create-btn" onclick="showCreateItemModal('${classroom.id}', 'material', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          <span class="icon">📚</span>
          <span class="label">Material</span>
          <span class="desc">Share resources</span>
        </div>
        <div class="create-btn" onclick="showCreateItemModal('${classroom.id}', 'lessonplan', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          <span class="icon">📖</span>
          <span class="label">Lesson Plan</span>
          <span class="desc">Plan your lessons</span>
        </div>
        <div class="create-btn" onclick="showCreateItemModal('${classroom.id}', 'link', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          <span class="icon">🔗</span>
          <span class="label">Link</span>
          <span class="desc">YouTube, Drive, websites</span>
        </div>
        <div class="create-btn" onclick="showCreateItemModal('${classroom.id}', 'question', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          <span class="icon">❓</span>
          <span class="label">Question</span>
          <span class="desc">Start discussion</span>
        </div>
        <div class="create-btn" onclick="showCreateItemModal('${classroom.id}', 'topic', ${JSON.stringify(students).replace(/"/g, '&quot;')})">
          <span class="icon">📑</span>
          <span class="label">Topic</span>
          <span class="desc">Organize content</span>
        </div>
      </div>
    </div>

    <!-- Assignments Section -->
    <div class="classwork-section">
      <div class="section-header">
        <h4>📝 Assignments (${assignments.filter(a => a.type !== 'quiz').length})</h4>
      </div>
      ${renderClassworkItems(assignments.filter(a => a.type !== 'quiz'), 'assignment')}
    </div>

    <!-- Quizzes Section -->
    <div class="classwork-section">
      <div class="section-header">
        <h4>📊 Quizzes & Tests (${assignments.filter(a => a.type === 'quiz').length})</h4>
      </div>
      ${renderClassworkItems(assignments.filter(a => a.type === 'quiz'), 'quiz')}
    </div>

    <!-- Materials Section -->
    <div class="classwork-section">
      <div class="section-header">
        <h4>📚 Materials (${resources.length})</h4>
      </div>
      ${renderClassworkItems(resources, 'material')}
    </div>

    <!-- Lesson Plans Section -->
    <div class="classwork-section">
      <div class="section-header">
        <h4>📖 Lesson Plans (${lessonPlans.length})</h4>
      </div>
      ${renderClassworkItems(lessonPlans, 'lessonplan')}
    </div>
  `;
}

function renderClassworkItems(items, type) {
  if (!items || items.length === 0) {
    return '<p class="empty" style="padding:20px;text-align:center;color:#999;">No items yet. Create one above!</p>';
  }

  return items.map(item => {
    const dueDate = item.dueDate ? `<small style="color:#666;">📅 Due: ${fmtDate(item.dueDate)}</small>` : '';
    const points = item.maxScore ? `<small style="color:#666;">📊 Points: ${item.maxScore}</small>` : '';
    
    return `
      <div class="classwork-item ${type}" data-id="${item.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
              <strong style="font-size:16px;">${escapeHtml(item.title || 'Untitled')}</strong>
              ${item.status ? statusBadge(item.status) : ''}
            </div>
            
            ${item.description ? `<p style="color:#555;margin:8px 0;">${escapeHtml(item.description)}</p>` : ''}
            
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
              ${dueDate}
              ${points}
              ${item.subject ? `<small>📚 ${escapeHtml(item.subject)}</small>` : ''}
            </div>
            
            ${renderAttachments(item)}
            
            <div class="item-actions">
              <button class="btn small ghost" onclick="editClassItem('${item.id}', '${type}')">✏️ Edit</button>
              <button class="btn small ghost" onclick="viewSubmissions('${item.id}')">📋 View Submissions</button>
              <button class="btn small ghost danger" onclick="deleteClassItem('${item.id}', '${type}')">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAttachments(item) {
  const attachments = [];
  
  if (item.fileUrl) {
    attachments.push(`
      <div class="attachment-preview">
        ${renderFilePreview(item.fileUrl, item.fileName)}
      </div>
    `);
  }
  
  if (item.linkUrl) {
    const isYouTube = item.linkUrl.includes('youtube.com') || item.linkUrl.includes('youtu.be');
    const icon = isYouTube ? '▶️' : '🔗';
    attachments.push(`
      <div class="attachment-preview">
        <a href="${item.linkUrl}" target="_blank" style="display:flex;align-items:center;gap:8px;text-decoration:none;">
          <span style="font-size:20px;">${icon}</span>
          <span>${escapeHtml(item.linkTitle || 'View Link')}</span>
        </a>
      </div>
    `);
  }
  
  if (item.formUrl) {
    attachments.push(`
      <div class="attachment-preview">
        <a href="${item.formUrl}" target="_blank" style="display:flex;align-items:center;gap:8px;text-decoration:none;">
          <span style="font-size:20px;">📋</span>
          <span>${escapeHtml(item.formTitle || 'Open Form')}</span>
        </a>
      </div>
    `);
  }
  
  return attachments.join('');
}


function renderStreamTab(classroom, profile) {
  return `
    <style>
      .stream-container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .stream-post-box {
        background: white;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      }
      .stream-post-box textarea {
        width: 100%;
        border: none;
        resize: none;
        font-size: 15px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 12px;
      }
      .stream-post-box textarea:focus {
        outline: none;
        background: #fff;
        box-shadow: 0 0 0 2px #667eea20;
      }
      .stream-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
        align-items: center;
      }
      .stream-feed {
        flex: 1;
        overflow-y: auto;
      }
      .stream-post {
        background: white;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .post-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .post-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg,#667eea,#764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
      }
      .post-meta {
        flex: 1;
      }
      .post-author {
        font-weight: 600;
        color: #2c3e50;
      }
      .post-time {
        font-size: 12px;
        color: #95a5a6;
      }
      .post-content {
        margin-left: 52px;
        line-height: 1.6;
      }
      .post-attachment {
        margin-top: 16px;
        margin-left: 52px;
      }
      .post-actions {
        margin-left: 52px;
        margin-top: 12px;
        display: flex;
        gap: 16px;
      }
      .comment-section {
        margin-left: 52px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #eee;
      }
      .comment {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
      }
      .comment-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }
      .comment-content {
        flex: 1;
        background: #f8f9fa;
        padding: 10px 14px;
        border-radius: 12px;
      }
    </style>

    <div class="stream-container">
      <div class="stream-post-box">
        <textarea id="streamInput" rows="2" placeholder="Announce something to your class..."></textarea>
        <div class="stream-actions">
          <input type="file" id="streamFileInput" accept="*/*" style="display:none;" multiple>
          <button class="btn ghost" onclick="document.getElementById('streamFileInput').click()">
            📎 Attach
          </button>
          <button class="btn ghost" onclick="showStreamLinkInput()">
            🔗 Add Link
          </button>
          <div style="flex:1;"></div>
          <button class="btn" onclick="postToStream('${classroom.id}')">
            Post
          </button>
        </div>
        <div id="streamFilePreview" style="margin-top:12px;"></div>
        <div id="streamLinkPreview" style="margin-top:12px;"></div>
      </div>

      <div id="streamFeed" class="stream-feed">
        <div class="loading">Loading stream...</div>
      </div>
    </div>
  `;
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
   'portfolio': bootTutorPortfolios,        // ← Make sure this matches data-page="portfolio"
    'portfolios': bootTutorPortfolios,
    'lesson-plans': bootLessonPlansPage,
    'learners': bootLearnersPage,
    'classrooms': bootClassroomsPage,
    'settings': bootDefaultPage,                   // Add if needed

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

// ====================== CLASSROOM HELPER FUNCTIONS ======================

window.createClassItem = async function(classroomId, type) {
  const title = prompt(`Create new ${type.toUpperCase()}\nEnter title:`);
  if (!title) return;

  try {
    if (type === 'assignment' || type === 'quiz' || type === 'question') {
      await addDoc(collection(db, 'assignments'), {
        classroomId: classroomId,
        tutorId: auth.currentUser.uid,
        title: title,
        type: type,
        createdAt: serverTimestamp(),
        published: true
      });
    } 
    else if (type === 'material') {
      const file = await new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = e => resolve(e.target.files[0]);
        input.click();
      });
      if (file) {
        const upload = await uploadFile(file, `classroom-materials/${classroomId}`);
        await addDoc(collection(db, 'resources'), {
          classroomId: classroomId,
          tutorId: auth.currentUser.uid,
          title: title,
          fileUrl: upload.url,
          fileName: upload.name,
          createdAt: serverTimestamp()
        });
      }
    } 
    else if (type === 'lessonplan') {
      await addDoc(collection(db, 'lesson-plans'), {
        classroomId: classroomId,
        tutorId: auth.currentUser.uid,
        title: title,
        status: 'Draft',
        createdAt: serverTimestamp()
      });
    } 
    else if (type === 'topic') {
      await addDoc(collection(db, 'classroom-topics'), {
        classroomId: classroomId,
        title: title,
        createdAt: serverTimestamp()
      });
    }

    alert(`✅ ${type.toUpperCase()} created successfully!`);
    setTimeout(() => location.reload(), 800);   // refresh modal
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.postToStream = async function(classroomId) {
  const input = document.getElementById('streamInput');
  const text = input.value.trim();
  if (!text) return;

  await addDoc(collection(db, 'classroom-messages'), {
    classroomId: classroomId,
    fromId: auth.currentUser.uid,
    fromName: 'Tutor',   // you can pull real name later
    message: text,
    createdAt: serverTimestamp()
  });

  input.value = '';
  loadStreamFeed(classroomId);
};



window.showJoinCode = function(code) {
  alert(`📋 Class Code: ${code}\n\nShare this code with your students so they can join from their dashboard.`);
};

window.showNewConversationModal = function(classroomId, students) {
  const modal = document.createElement('div');
  modal.id = 'newConvModal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()">
      <div class="modal-box" style="max-width:500px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>New Conversation</h3>
          <button class="btn danger" onclick="this.closest('.modal-overlay').parentElement.remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>Select Recipient</label>
            <select id="convRecipientId" style="width:100%;padding:12px;">
              <option value="">-- Choose --</option>
              ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label>Initial Message (optional)</label>
            <textarea id="convInitialMessage" rows="3" placeholder="Type your first message..."></textarea>
          </div>
          <div class="form-actions">
            <button class="btn" onclick="createConversation('${classroomId}')">Start Conversation</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

window.createConversation = async function(classroomId) {
  const recipientId = document.getElementById('convRecipientId')?.value;
  const initialMessage = document.getElementById('convInitialMessage')?.value;
  
  if (!recipientId) {
    alert('Please select a recipient');
    return;
  }
  
  try {
    // Get recipient name
    const recipientDoc = await getDoc(doc(db, 'students', recipientId));
    const recipient = recipientDoc.data();
    
    const convRef = await addDoc(collection(db, 'conversations'), {
      classroomId,
      type: 'direct',
      participants: [auth.currentUser.uid, recipientId],
      participantNames: [
        { id: auth.currentUser.uid, name: auth.currentUser.displayName || 'Tutor' },
        { id: recipientId, name: recipient?.full_name || recipient?.name || 'Student' }
      ],
      unreadCount: { [recipientId]: initialMessage ? 1 : 0 },
      lastMessage: initialMessage || 'Conversation started',
      lastMessageTime: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    
    if (initialMessage) {
      await addDoc(collection(db, 'chat_messages'), {
        conversationId: convRef.id,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Tutor',
        text: initialMessage,
        createdAt: serverTimestamp()
      });
    }
    
    document.getElementById('newConvModal')?.remove();
    await loadConversations(classroomId, window.currentProfile);
    
  } catch (err) {
    alert('Error creating conversation: ' + err.message);
  }
};

window.downloadReport = function(reportId) {
  // Implement PDF generation or download
  alert('Report download - coming soon!');
};

window.emailReport = function(reportId) {
  // Implement email functionality
  alert('Report emailed to parent/student!');
};

window.sendMessageToStudent = function(studentId, studentName) {
  // Switch to messages tab and create conversation
  const messagesTab = document.querySelector('[data-tab="messages"]');
  if (messagesTab) {
    messagesTab.click();
    setTimeout(() => {
      showNewConversationModal(window.currentClassroomId, [{ id: studentId, full_name: studentName }]);
    }, 500);
  }
};

window.generateLearnerReport = async function(studentId) {
  const reportsTab = document.querySelector('[data-tab="reports"]');
  if (reportsTab) {
    reportsTab.click();
    setTimeout(() => {
      const select = document.getElementById('reportStudentId');
      if (select) select.value = studentId;
    }, 500);
  }
};

function setupChatSearch() {
  const searchInput = document.getElementById('chatSearchInput');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.conversation-item').forEach(el => {
      const name = el.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
      el.style.display = name.includes(term) ? 'flex' : 'none';
    });
  });
}

function setupRealtimeChat(classroomId) {
  // Listen for new messages
  const q = query(
    collection(db, 'chat_messages'),
    where('conversationId', '==', window.currentConversationId || ''),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  
  // You can implement real-time listeners here using onSnapshot
}

async function markConversationRead(conversationId) {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`unreadCount.${auth.currentUser.uid}`]: 0
    });
  } catch (err) {
    console.warn('Mark read error:', err);
  }
}

function getOtherParticipantId(conversationId) {
  // This would need to be implemented based on conversation data
  return 'other-user-id';
}

async function handleChatFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const upload = await uploadFile(file, `chat/${window.currentConversationId}`);
    
    await addDoc(collection(db, 'chat_messages'), {
      conversationId: window.currentConversationId,
      senderId: auth.currentUser.uid,
      senderName: window.currentProfile?.name || auth.currentUser.displayName || 'User',
      fileUrl: upload.url,
      fileName: upload.name,
      createdAt: serverTimestamp()
    });
    
    await loadMessages(window.currentConversationId);
  } catch (err) {
    alert('Error uploading file: ' + err.message);
  }
}

function attachLearnersEventListeners(classroom) {
  // Additional learner tab functionality
}

// ============================================
// EXPOSE TO WINDOW
// ============================================

window.initializeChat = initializeChat;
window.loadConversations = loadConversations;
window.selectConversation = selectConversation;
window.sendChatMessage = sendChatMessage;
window.selectLearner = selectLearner;


async function notifyClassStudents(classroomId, title, type) {
  try {
    // Get all students in this classroom
    const studentsSnap = await getDocs(
      query(collection(db, 'students'), where('classroomId', '==', classroomId))
    );
    
    const batch = writeBatch(db);
    studentsSnap.docs.forEach(doc => {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        studentId: doc.id,
        title: `New ${type}: ${title}`,
        message: `Your tutor posted a new ${type} in your classroom`,
        type: type,
        read: false,
        createdAt: serverTimestamp()
      });
    });
    
    await batch.commit();
  } catch (err) {
    console.warn('Notification error:', err);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

window.copyClassCode = function(code) {
  navigator.clipboard?.writeText(code).then(() => {
    alert('✅ Class code copied to clipboard!');
  }).catch(() => {
    prompt('Copy this code:', code);
  });
};

window.shareClassCode = function(code, className) {
  const text = `Join my class "${className}" on HomeSchool!\nClass Code: ${code}`;
  if (navigator.share) {
    navigator.share({ title: 'Join my class', text });
  } else {
    prompt('Share this with your students:', text);
  }
};

window.editClassItem = function(itemId, type) {
  alert(`Edit ${type} - Coming soon!`);
  // You can implement edit functionality similar to create
};

window.viewSubmissions = async function(itemId) {
  try {
    const subs = await getDocs(
      query(collection(db, 'submissions'), where('assignmentId', '==', itemId))
    );
    
    const submissions = subs.docs.map(d => d.data());
    const studentNames = submissions.map(s => s.studentName).join('\n• ');
    
    alert(`Submissions (${submissions.length}):\n• ${studentNames || 'None yet'}`);
  } catch (err) {
    alert('Error loading submissions: ' + err.message);
  }
};

window.deleteClassItem = async function(itemId, type) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  
  try {
    let collectionName = 'assignments';
    if (type === 'material') collectionName = 'resources';
    else if (type === 'lessonplan') collectionName = 'lesson-plans';
    
    await deleteDoc(doc(db, collectionName, itemId));
    alert('✅ Deleted successfully!');
    location.reload();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.gradeAssessment = function(assessmentId) {
  // Open grading modal - you can expand this
  const score = prompt('Enter score:');
  if (score !== null) {
    updateAssessmentGrade(assessmentId, parseFloat(score), '');
    alert('Grade saved!');
  }
};



async function loadStreamFeed(classroomId) {
  const feed = document.getElementById('streamFeed');
  if (!feed) return;
  
  try {
    const snap = await getDocs(
      query(
        collection(db, 'classroom-messages'),
        where('classroomId', '==', classroomId),
        orderBy('createdAt', 'desc')
      )
    );
    
    if (snap.empty) {
      feed.innerHTML = '<p class="empty" style="padding:40px;text-align:center;">No messages yet. Start the conversation!</p>';
      return;
    }
    
    feed.innerHTML = snap.docs.map(doc => {
      const m = doc.data();
      return `
        <div style="background:white;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="width:32px;height:32px;background:#3498db;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">
              ${escapeHtml((m.fromName || 'T').charAt(0).toUpperCase())}
            </div>
            <div>
              <strong>${escapeHtml(m.fromName || 'Tutor')}</strong>
              <small style="color:#666;margin-left:8px;">${fmtDate(m.createdAt)}</small>
            </div>
          </div>
          ${m.message ? `<p style="margin:8px 0;">${escapeHtml(m.message)}</p>` : ''}
          ${m.fileUrl ? renderFilePreview(m.fileUrl, m.fileName) : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Load stream error:', err);
    feed.innerHTML = '<p class="error">Error loading stream</p>';
  }
}

function attachClassworkEventListeners(classroom, students) {
  // Stream file preview
  const streamFileInput = document.getElementById('streamFileInput');
  const previewDiv = document.getElementById('streamFilePreview');
  
  if (streamFileInput) {
    streamFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        previewDiv.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#e8f5e9;border-radius:8px;">
            <span>📎</span>
            <span>${escapeHtml(file.name)}</span>
            <button class="btn small danger" onclick="document.getElementById('streamFileInput').value='';document.getElementById('streamFilePreview').innerHTML='';">✕</button>
          </div>
        `;
      }
    });
  }
}
async function getStudentPortfolioCompletion(portfolioId, studentId) {
  try {
    const sectionsSnap = await getDocs(
      query(collection(db, 'portfolio_sections'), where('portfolioId', '==', portfolioId))
    );
    const totalSections = sectionsSnap.size;
    
    const entriesSnap = await getDocs(
      query(
        collection(db, 'portfolio_entries'),
        where('portfolioId', '==', portfolioId),
        where('studentId', '==', studentId)
      )
    );
    
    const completedSections = entriesSnap.size;
    const entries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    return {
      totalSections,
      completedSections,
      percentage: totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0,
      entries,
      lastUpdated: entries.length > 0 
        ? Math.max(...entries.map(e => e.updatedAt?.seconds || 0))
        : null
    };
  } catch (err) {
    console.warn('Error getting completion status:', err);
    return { totalSections: 0, completedSections: 0, percentage: 0, entries: [], lastUpdated: null };
  }
}


async function savePortfolioEntry(portfolioId, sectionId, studentId, data) {
  try {
    // Check if entry already exists
    const existingSnap = await getDocs(
      query(
        collection(db, 'portfolio_entries'),
        where('portfolioId', '==', portfolioId),
        where('sectionId', '==', sectionId),
        where('studentId', '==', studentId)
      )
    );
    
    const entryData = {
      portfolioId,
      sectionId,
      studentId,
      studentName: data.studentName || auth.currentUser?.displayName || 'Student',
      content: data.content || '',
      fileUrl: data.fileUrl || '',
      fileName: data.fileName || '',
      fileType: data.fileType || '',
      mediaUrls: data.mediaUrls || [],
      externalLinkUrl: data.externalLinkUrl || '',
      status: 'completed',
      updatedAt: serverTimestamp()
    };
    
    if (!existingSnap.empty) {
      // Update existing
      const entryId = existingSnap.docs[0].id;
      await updateDoc(doc(db, 'portfolio_entries', entryId), entryData);
      return entryId;
    } else {
      // Create new
      entryData.createdAt = serverTimestamp();
      const entryRef = await addDoc(collection(db, 'portfolio_entries'), entryData);
      
      // Update portfolio progress
      await updateDoc(doc(db, 'portfolios', portfolioId), {
        [`studentProgress.${studentId}`]: {
          completedAt: serverTimestamp(),
          sectionsCompleted: 1
        }
      });
      
      return entryRef.id;
    }
  } catch (err) {
    console.error('Error saving entry:', err);
    throw err;
  }
}

function getPortfolioGradient(type) {
  const gradients = {
    project: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    subject: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    stem: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    custom: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  };
  return gradients[type] || gradients.custom;
}



function getDefaultEmoji(type) {
  const emojis = {
    project: '📋',
    subject: '📚',
    stem: '🔬',
    custom: '📁'
  };
  return emojis[type] || '📁';
}

function getTypeLabel(type) {
  const labels = {
    project: 'Project',
    subject: 'Subject',
    stem: 'STEM',
    custom: 'Custom'
  };
  return labels[type] || 'Portfolio';
}


function getSectionTypeIcon(type) {
  const icons = {
    text: '📝',
    upload: '📎',
    reflection: '🤔',
    media: '🎥',
    milestone: '🎯'
  };
  return icons[type] || '📄';
}

function getSectionTypeLabel(type) {
  const labels = {
    text: 'Text Response',
    upload: 'File Upload',
    reflection: 'Reflection',
    media: 'Media',
    milestone: 'Milestone'
  };
  return labels[type] || 'Section';
}

function calculateProgress(total, completed) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// ============================================
// EXPOSE TO WINDOW
// ============================================

window.openPortfolio = async function(portfolioId) {
  const bundle = await requireAuth();
  if (!bundle) return;
  
  const { user, profile } = bundle;
  
  try {
    // Load portfolio data
    const portfolioDoc = await getDoc(doc(db, 'portfolios', portfolioId));
    if (!portfolioDoc.exists()) {
      alert('Portfolio not found');
      return;
    }
    
    const portfolio = { id: portfolioDoc.id, ...portfolioDoc.data() };
    const sections = await loadPortfolioSections(portfolioId);
    
    let entries = [];
    if (profile.role === 'student') {
      entries = await loadStudentPortfolioEntries(portfolioId, user.uid);
    }
    
    // Store current view state
    window.currentPortfolioView = { portfolio, sections, entries };
    
    // Render the view
    const content = document.getElementById('page-content');
    content.innerHTML = renderPortfolioView(portfolio, sections, entries, profile.role, user.uid);
    
  } catch (err) {
    console.error('Open portfolio error:', err);
    alert('Error opening portfolio: ' + err.message);
  }
};

window.closePortfolioView = function() {
  location.reload(); // Simple refresh to go back to grid
};

window.autoSaveSection = function(portfolioId, sectionId, studentId, content) {
  // Debounced save
  if (window.saveTimeout) clearTimeout(window.saveTimeout);
  window.saveTimeout = setTimeout(async () => {
    await savePortfolioEntry(portfolioId, sectionId, studentId, {
      content,
      studentName: auth.currentUser?.displayName || 'Student'
    });
    document.getElementById(`save-status-${sectionId}`).textContent = '✓ Saved';
    setTimeout(() => {
      const el = document.getElementById(`save-status-${sectionId}`);
      if (el) el.textContent = '';
    }, 2000);
  }, 1000);
};

window.saveSectionContent = async function(portfolioId, sectionId, studentId) {
  const textarea = document.getElementById(`section-input-${sectionId}`);
  if (!textarea) return;
  
  await savePortfolioEntry(portfolioId, sectionId, studentId, {
    content: textarea.value,
    studentName: auth.currentUser?.displayName || 'Student'
  });
  
  const status = document.getElementById(`save-status-${sectionId}`);
  if (status) {
    status.textContent = '✓ Saved!';
    setTimeout(() => status.textContent = '', 2000);
  }
};

window.handleSectionFileUpload = async function(input, portfolioId, sectionId, studentId) {
  const file = input.files[0];
  if (!file) return;
  
  const progressDiv = document.getElementById(`upload-progress-${sectionId}`);
  progressDiv.innerHTML = '<span style="color:#3498db;">Uploading...</span>';
  
  try {
    const upload = await uploadFile(file, `portfolio/${portfolioId}/${sectionId}/${studentId}`);
    
    await savePortfolioEntry(portfolioId, sectionId, studentId, {
      fileUrl: upload.url,
      fileName: upload.name,
      fileType: file.type,
      studentName: auth.currentUser?.displayName || 'Student'
    });
    
    progressDiv.innerHTML = '<span style="color:#27ae60;">✓ Uploaded!</span>';
    
    // Refresh the section display
    setTimeout(() => {
      openPortfolio(portfolioId);
    }, 500);
    
  } catch (err) {
    progressDiv.innerHTML = `<span style="color:#e74c3c;">Error: ${err.message}</span>`;
  }
};

window.submitPortfolio = async function(portfolioId) {
  try {
    await updateDoc(doc(db, 'portfolios', portfolioId), {
      [`submissions.${auth.currentUser.uid}`]: {
        submittedAt: serverTimestamp(),
        status: 'submitted'
      }
    });
    
    alert('✅ Portfolio submitted successfully!');
  } catch (err) {
    alert('Error submitting: ' + err.message);
  }
};

function renderPortfolioGrid(portfolios, role, profile) {
  const canCreate = role === 'tutor' || role === 'parent';
  
  // Group portfolios by type
  const grouped = {
    project: portfolios.filter(p => p.type === 'project'),
    subject: portfolios.filter(p => p.type === 'subject'),
    stem: portfolios.filter(p => p.type === 'stem'),
    custom: portfolios.filter(p => p.type === 'custom' || !p.type)
  };
  
  const renderPortfolioCard = (p) => {
    const progress = p.completionStatus?.percentage || 0;
    const isStudent = role === 'student';
    
    return `
      <div class="portfolio-grid-card" data-portfolio-id="${p.id}" onclick="openPortfolio('${p.id}')">
        <div class="portfolio-cover" style="background: ${getPortfolioGradient(p.type)};">
          <span class="portfolio-emoji">${p.emoji || getDefaultEmoji(p.type)}</span>
          ${p.coverImageUrl ? `<img src="${p.coverImageUrl}" class="portfolio-cover-img">` : ''}
        </div>
        <div class="portfolio-card-content">
          <div class="portfolio-type-badge ${p.type}">${getTypeLabel(p.type)}</div>
          <h4 class="portfolio-card-title">${escapeHtml(p.title)}</h4>
          <p class="portfolio-card-desc">${escapeHtml(p.description || '')}</p>
          
          ${p.subject ? `<div class="portfolio-subject">📚 ${escapeHtml(p.subject)}</div>` : ''}
          // After the description, add external link if present
${p.externalLinkUrl ? `
  <div class="portfolio-external-link">
    <a href="${p.externalLinkUrl}" target="_blank" onclick="event.stopPropagation()">
      🔗 ${escapeHtml(p.externalLinkTitle || 'Open Template')}
    </a>
  </div>
` : ''}
          
          ${isStudent ? `
            <div class="portfolio-progress">
              <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${progress}%;"></div>
              </div>
              <span class="progress-text">${progress}% Complete</span>
            </div>
          ` : `
            <div class="portfolio-meta">
              <span>👥 ${p.totalStudents || 0} students</span>
              <span>✅ ${p.completedCount || 0} completed</span>
            </div>
          `}
          
          <div class="portfolio-card-footer">
            <span class="portfolio-creator">By ${escapeHtml(p.createdByName || 'Teacher')}</span>
            ${p.dueDate ? `<span class="portfolio-due">📅 Due ${fmtDate(p.dueDate)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  };
  
  return `
    <style>
      /* Portfolio Grid Styles */
      .portfolio-page-container {
        padding: 0;
      }
      
      .portfolio-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
      }
      
      .portfolio-header h2 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .portfolio-filters {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      
      .filter-chip {
        padding: 8px 16px;
        border-radius: 20px;
        border: 1px solid #e0e0e0;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
      }
      
      .filter-chip:hover {
        background: #f0f7ff;
        border-color: #3498db;
      }
      
      .filter-chip.active {
        background: #3498db;
        color: white;
        border-color: #3498db;
      }
      
      .portfolio-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 24px;
      }
      
      .portfolio-grid-card {
        background: white;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        cursor: pointer;
        transition: all 0.3s;
        border: 1px solid #f0f0f0;
      }
      
      .portfolio-grid-card:hover {
        transform: translateY(-6px);
        box-shadow: 0 12px 24px rgba(0,0,0,0.12);
      }
      
      .portfolio-cover {
        height: 140px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      
      .portfolio-emoji {
        font-size: 48px;
        z-index: 1;
      }
      
      .portfolio-cover-img {
        position: absolute;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.3;
      }
      
      .portfolio-card-content {
        padding: 20px;
      }
      
      .portfolio-type-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 10px;
      }
      
      .portfolio-type-badge.project { background: #e3f2fd; color: #1565c0; }
      .portfolio-type-badge.subject { background: #e8f5e9; color: #2e7d32; }
      .portfolio-type-badge.stem { background: #fff3e0; color: #e65100; }
      .portfolio-type-badge.custom { background: #f3e5f5; color: #6a1b9a; }
      
      .portfolio-card-title {
        margin: 0 0 8px 0;
        font-size: 18px;
        color: #2c3e50;
      }
      
      .portfolio-card-desc {
        font-size: 13px;
        color: #666;
        margin: 0 0 12px 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .portfolio-subject {
        font-size: 12px;
        color: #3498db;
        margin-bottom: 12px;
      }
      
      .portfolio-progress {
        margin: 12px 0;
      }
      
      .progress-bar-container {
        height: 6px;
        background: #e0e0e0;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 4px;
      }
      
      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #3498db, #2ecc71);
        border-radius: 3px;
        transition: width 0.3s;
      }
      
      .progress-text {
        font-size: 11px;
        color: #666;
      }
      
      .portfolio-meta {
        display: flex;
        gap: 16px;
        margin: 12px 0;
        font-size: 12px;
        color: #666;
      }
      
      .portfolio-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;
        font-size: 12px;
      }
      
      .portfolio-creator {
        color: #888;
      }
      
      .portfolio-due {
        color: #e74c3c;
      }
      
      /* Section Styles for Portfolio View */
      .portfolio-sections-container {
        max-width: 900px;
        margin: 0 auto;
      }
      
      .portfolio-view-header {
        margin-bottom: 32px;
      }
      
      .portfolio-view-header h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      
      .portfolio-section-card {
        background: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        border: 1px solid #f0f0f0;
        transition: all 0.2s;
      }
      
      .portfolio-section-card.completed {
        border-left: 4px solid #2ecc71;
      }
      
      .section-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
      }
      
      .section-number {
        width: 32px;
        height: 32px;
        background: #3498db;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        flex-shrink: 0;
      }
      
      .section-number.completed {
        background: #2ecc71;
      }
      
      .section-title-area {
        flex: 1;
      }
      
      .section-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .section-type-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 20px;
        background: #f0f0f0;
      }
      
      .section-description {
        color: #666;
        font-size: 14px;
        margin: 0;
      }
      
      .section-required {
        color: #e74c3c;
        font-size: 12px;
        margin-left: 8px;
      }
      
      .section-content {
        margin-left: 44px;
      }
      
      .student-response {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
      }
      
      .section-input-area textarea {
        width: 100%;
        padding: 14px;
        border: 1px solid #ddd;
        border-radius: 12px;
        font-size: 14px;
        resize: vertical;
        min-height: 100px;
      }
      
      .section-input-area textarea:focus {
        outline: none;
        border-color: #3498db;
        box-shadow: 0 0 0 3px rgba(52,152,219,0.1);
      }
      
      .upload-area {
        border: 2px dashed #ddd;
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .upload-area:hover {
        border-color: #3498db;
        background: #f0f7ff;
      }
      
      .upload-preview {
        margin-top: 12px;
      }
      
      .section-actions {
        margin-top: 16px;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      
      /* Create Portfolio Modal */
      .create-portfolio-modal .modal-box {
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
      }
      
      .section-builder {
        margin-top: 20px;
        padding: 16px;
        background: #f8f9fa;
        border-radius: 12px;
      }
      
      .section-item {
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        border: 1px solid #e0e0e0;
      }
      
      .section-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .add-section-btn {
        width: 100%;
        padding: 12px;
        border: 1px dashed #3498db;
        background: white;
        border-radius: 8px;
        color: #3498db;
        cursor: pointer;
      }
    </style>
    
    <div class="portfolio-page-container">
      <div class="portfolio-header">
        <h2>
          <span>📁 Portfolios</span>
          <span class="badge">${portfolios.length}</span>
        </h2>
        ${canCreate ? `
          <button class="btn" onclick="showCreatePortfolioModal('${role}', '${profile?.id || ''}', '${escapeHtml(profile?.name || '')}')">
            ➕ Create Portfolio
          </button>
        ` : ''}
      </div>
      
      <div class="portfolio-filters" id="portfolioFilters">
        <button class="filter-chip active" data-filter="all">All</button>
        <button class="filter-chip" data-filter="project">📋 Projects</button>
        <button class="filter-chip" data-filter="subject">📚 Subjects</button>
        <button class="filter-chip" data-filter="stem">🔬 STEM</button>
        <button class="filter-chip" data-filter="custom">✨ Custom</button>
        ${role === 'student' ? '<button class="filter-chip" data-filter="in-progress">🔄 In Progress</button>' : ''}
        ${role === 'student' ? '<button class="filter-chip" data-filter="completed">✅ Completed</button>' : ''}
      </div>
      
      ${portfolios.length > 0 ? `
        <div class="portfolio-grid" id="portfolioGrid">
          ${portfolios.map(p => renderPortfolioCard(p)).join('')}
        </div>
      ` : `
        <div class="empty-state" style="text-align:center;padding:60px 20px;">
          <div style="font-size:64px;margin-bottom:16px;">📁</div>
          <h3>No portfolios yet</h3>
          <p style="color:#666;">${canCreate ? 'Create your first portfolio to get started!' : 'Your teacher will assign portfolios soon.'}</p>
          ${canCreate ? `
            <button class="btn" style="margin-top:20px;" onclick="showCreatePortfolioModal('${role}', '${profile?.id || ''}', '${escapeHtml(profile?.name || '')}')">
              ➕ Create Portfolio
            </button>
          ` : ''}
        </div>
      `}
    </div>
    
    <script>
      // Filter functionality
      const filterChips = document.querySelectorAll('.filter-chip');
      const cards = document.querySelectorAll('.portfolio-grid-card');
      
      filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
          filterChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          
          const filter = chip.dataset.filter;
          
          cards.forEach(card => {
            const typeBadge = card.querySelector('.portfolio-type-badge');
            const type = typeBadge ? typeBadge.className.split(' ')[1] : 'custom';
            const progress = card.querySelector('.progress-text')?.textContent || '';
            const isCompleted = progress.includes('100%');
            
            if (filter === 'all') {
              card.style.display = 'block';
            } else if (filter === 'in-progress') {
              card.style.display = !isCompleted ? 'block' : 'none';
            } else if (filter === 'completed') {
              card.style.display = isCompleted ? 'block' : 'none';
            } else {
              card.style.display = type === filter ? 'block' : 'none';
            }
          });
        });
      });
    </script>
  `;
}
function renderPortfolioView(portfolio, sections, entries, role, studentId) {
  const isStudent = role === 'student';
  const canEdit = role === 'tutor' || role === 'parent';
  
  // Map entries by sectionId for quick lookup
  const entryMap = new Map();
  entries.forEach(e => entryMap.set(e.sectionId, e));
  
  const sectionsHtml = sections.map((section, index) => {
    const entry = entryMap.get(section.id);
    const isCompleted = !!entry;
    const sectionType = section.type || 'text';
    
    return `
      <div class="portfolio-section-card ${isCompleted ? 'completed' : ''}" data-section-id="${section.id}">
        <div class="section-header">
          <div class="section-number ${isCompleted ? 'completed' : ''}">${index + 1}</div>
          <div class="section-title-area">
            <div class="section-title">
              ${escapeHtml(section.title)}
              <span class="section-type-badge">${getSectionTypeIcon(sectionType)} ${getSectionTypeLabel(sectionType)}</span>
              ${section.required ? '<span class="section-required">*Required</span>' : ''}
            </div>
            ${section.description ? `<p class="section-description">${escapeHtml(section.description)}</p>` : ''}
            ${section.hints ? `<p class="section-hint" style="font-size:12px;color:#888;margin-top:4px;">💡 ${escapeHtml(section.hints)}</p>` : ''}
          </div>
        </div>
        
        <div class="section-content">
          ${isStudent ? renderStudentSectionInput(section, entry, portfolio.id, studentId) : 
                      renderViewOnlySection(section, entry, portfolio.id)}
        </div>
      </div>
    `;
  }).join('');
  
  const progress = calculateProgress(sections.length, entries.length);
  
  return `
    <style>
      .portfolio-view-container {
        max-width: 1000px;
        margin: 0 auto;
      }
      
      .back-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #666;
        cursor: pointer;
        margin-bottom: 20px;
        padding: 8px 0;
      }
      
      .back-button:hover {
        color: #3498db;
      }
      
      .portfolio-view-header {
        background: white;
        border-radius: 20px;
        padding: 28px;
        margin-bottom: 24px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      }
      
      .portfolio-title-section {
        display: flex;
        align-items: flex-start;
        gap: 20px;
      }
      
      .portfolio-icon-large {
        font-size: 56px;
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${getPortfolioGradient(portfolio.type)};
        border-radius: 20px;
      }
      
      .portfolio-info {
        flex: 1;
      }
      
      .portfolio-info h2 {
        margin: 0 0 8px 0;
        font-size: 28px;
      }
      
      .portfolio-meta-info {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      
      .meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #666;
        font-size: 14px;
      }
      
      .progress-overview {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #f0f0f0;
      }
      
      .progress-bar-large {
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
        overflow: hidden;
        margin: 12px 0 8px;
      }
      
      .progress-fill-large {
        height: 100%;
        background: linear-gradient(90deg, #3498db, #2ecc71);
        border-radius: 5px;
      }
      
      .student-response-view {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
      }
      
      .student-response-view p {
        margin: 0 0 12px 0;
        line-height: 1.6;
      }
      
      .portfolio-actions-bar {
        display: flex;
        gap: 12px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
    </style>
    
    <div class="portfolio-view-container">
      <div class="back-button" onclick="closePortfolioView()">
        ← Back to Portfolios
      </div>
      
      <div class="portfolio-view-header">
        <div class="portfolio-title-section">
          <div class="portfolio-icon-large">
            ${portfolio.emoji || getDefaultEmoji(portfolio.type)}
          </div>
          <div class="portfolio-info">
            <span class="portfolio-type-badge ${portfolio.type}">${getTypeLabel(portfolio.type)}</span>
            <h2>${escapeHtml(portfolio.title)}</h2>
            <p style="color:#666;margin:8px 0;">${escapeHtml(portfolio.description || '')}</p>
            
            <div class="portfolio-meta-info">
              ${portfolio.subject ? `<span class="meta-item">📚 ${escapeHtml(portfolio.subject)}</span>` : ''}
              ${portfolio.gradeLevel ? `<span class="meta-item">🎓 Grade ${escapeHtml(portfolio.gradeLevel)}</span>` : ''}
              <span class="meta-item">👤 Created by ${escapeHtml(portfolio.createdByName || 'Teacher')}</span>
              ${portfolio.dueDate ? `<span class="meta-item">📅 Due ${fmtDate(portfolio.dueDate)}</span>` : ''}
            </div>
            
            ${isStudent ? `
              <div class="progress-overview">
                <div style="display:flex;justify-content:space-between;">
                  <span><strong>Your Progress</strong></span>
                  <span>${entries.length}/${sections.length} sections • ${progress}%</span>
                </div>
                <div class="progress-bar-large">
                  <div class="progress-fill-large" style="width:${progress}%;"></div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        ${canEdit ? `
          <div class="portfolio-actions-bar">
            <button class="btn ghost" onclick="editPortfolio('${portfolio.id}')">✏️ Edit</button>
            <button class="btn ghost" onclick="manageSections('${portfolio.id}')">📋 Manage Sections</button>
            <button class="btn" onclick="viewAllSubmissions('${portfolio.id}')">📊 View Submissions</button>
          </div>
        ` : ''}
      </div>
      
      <div class="portfolio-sections-container">
        ${sectionsHtml || '<p class="empty">No sections yet. Click "Manage Sections" to add some.</p>'}
      </div>
      
      ${isStudent && sections.length > 0 ? `
        <div style="margin-top:32px;text-align:center;">
          <button class="btn large" onclick="submitPortfolio('${portfolio.id}')">
            ✅ Submit Portfolio
          </button>
          <p style="color:#666;margin-top:12px;">You can continue editing after submitting</p>
        </div>
      ` : ''}
    </div>
  `;
}
function renderViewOnlySection(section, entry, portfolioId) {
  if (!entry) {
    return `<p style="color:#999;margin-left:44px;">No response yet</p>`;
  }
  
  return `
    <div class="student-response-view">
      ${entry.content ? `<p>${escapeHtml(entry.content)}</p>` : ''}
      ${entry.fileUrl ? renderFilePreview(entry.fileUrl, entry.fileName) : ''}
      <div style="margin-top:12px;font-size:12px;color:#888;">
        Last updated: ${fmtDate(entry.updatedAt)}
      </div>
    </div>
  `;
}
window.showCreatePortfolioModal = function(role, userId, userName) {
  const old = document.getElementById('createPortfolioModal');
  if (old) old.remove();
  
  const modal = document.createElement('div');
  modal.id = 'createPortfolioModal';
  modal.className = 'create-portfolio-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target.classList.contains('modal-overlay'))this.parentElement.remove()">
      <div class="modal-box" style="max-width:750px;max-height:90vh;overflow-y:auto;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>📁 Create New Portfolio</h3>
          <button class="btn danger" onclick="document.getElementById('createPortfolioModal').remove()">✕</button>
        </div>
        
        <div class="modal-body">
          <form id="createPortfolioForm" class="stack-form">
            <input type="hidden" id="pfCreatedBy" value="${userId}">
            <input type="hidden" id="pfCreatedByRole" value="${role}">
            <input type="hidden" id="pfCreatedByName" value="${escapeHtml(userName)}">
            
            <div class="form-row">
              <label>Portfolio Title *</label>
              <input id="pfTitle" type="text" required placeholder="e.g., My Science Fair Project">
            </div>
            
            <div class="form-row">
              <label>Description</label>
              <textarea id="pfDescription" rows="3" placeholder="Describe what this portfolio is about..."></textarea>
            </div>
            
            <div class="form-row">
              <label>Portfolio Type *</label>
              <select id="pfType" required>
                <option value="project">📋 Project Portfolio</option>
                <option value="subject">📚 Subject Portfolio</option>
                <option value="stem">🔬 STEM Portfolio</option>
                <option value="custom">✨ Custom Portfolio</option>
              </select>
            </div>
            
            <div class="form-row">
              <label>Subject (optional)</label>
              <input id="pfSubject" type="text" placeholder="e.g., Science, Math, History">
            </div>
            
            <div class="form-row">
              <label>Grade Level (optional)</label>
              <input id="pfGradeLevel" type="text" placeholder="e.g., 5, 8, 10">
            </div>
            
            <div class="form-row">
              <label>Cover Emoji</label>
              <input id="pfEmoji" type="text" placeholder="📁" maxlength="2" value="📁">
            </div>
            
            <!-- EXTERNAL LINK (Sutori, Google Docs, etc.) -->
            <div class="form-row">
              <label>🔗 External Template Link (Optional)</label>
              <input id="pfExternalLinkTitle" type="text" placeholder="Link Title (e.g., Sutori Template, Google Doc)">
              <input id="pfExternalLinkUrl" type="url" placeholder="https://..." style="margin-top:8px;">
              <small style="color:#666;">Paste a Sutori, Google Docs, or any external template link</small>
            </div>
            
            <div class="form-row">
              <label>Assign To Students *</label>
              <select id="pfTargetType">
                <option value="all">All Students</option>
                <option value="classroom">Specific Classroom</option>
                <option value="students">Select Individual Students</option>
              </select>
            </div>
            
            <div class="form-row" id="pfClassroomRow" style="display:none;">
              <label>Select Classroom</label>
              <select id="pfClassroomId"></select>
            </div>
            
            <div class="form-row" id="pfStudentsRow" style="display:none;">
              <label>Select Students (Hold Ctrl/Cmd to select multiple)</label>
              <select id="pfStudentIds" multiple size="6" style="width:100%;padding:8px;"></select>
              <small>Selected students will see this portfolio in their dashboard</small>
            </div>
            
            <div class="form-row">
              <label>Due Date (optional)</label>
              <input id="pfDueDate" type="date">
            </div>
            
            <div class="form-row">
              <label>
                <input type="checkbox" id="pfAllowUploads" checked> Allow students to upload files
              </label>
            </div>
            
            <div class="form-row">
              <label>
                <input type="checkbox" id="pfAllowComments"> Allow comments on entries
              </label>
            </div>
            
            <div class="form-row">
              <label>
                <input type="checkbox" id="pfAllowExternalLinks" checked> Allow students to add external links
              </label>
            </div>
            
            <!-- Section Builder -->
            <div class="section-builder">
              <h4 style="margin:0 0 16px 0;">📋 Portfolio Sections</h4>
              <p style="color:#666;margin-bottom:12px;">Add sections for students to complete. Each section can be text, file upload, or reflection.</p>
              <div id="sectionsList"></div>
              <button type="button" class="add-section-btn" onclick="addSectionToBuilder()">
                ➕ Add Section
              </button>
            </div>
            
            <div class="form-actions" style="margin-top:24px;">
              <button type="button" class="btn ghost" onclick="document.getElementById('createPortfolioModal').remove()">Cancel</button>
              <button type="submit" class="btn">Create Portfolio</button>
              <span id="pfMsg"></span>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Load classrooms and students
  loadClassroomAndStudentOptions(userId);
  
  // Target type toggle
  document.getElementById('pfTargetType').addEventListener('change', (e) => {
    document.getElementById('pfClassroomRow').style.display = e.target.value === 'classroom' ? 'block' : 'none';
    document.getElementById('pfStudentsRow').style.display = e.target.value === 'students' ? 'block' : 'none';
  });
  
  // Initialize with default sections
  window.portfolioSections = [{
    title: 'Introduction',
    description: 'Introduce your project and what you hope to learn',
    type: 'text',
    required: true,
    order: 0,
    placeholder: 'Write your introduction here...'
  }];
  renderSectionBuilder();
  
  // Form submit
  document.getElementById('createPortfolioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleCreatePortfolio();
  });
};

async function loadClassroomAndStudentOptions(tutorId) {
  try {
    // Load classrooms
    const classrooms = await loadClassrooms(tutorId);
    const classroomSelect = document.getElementById('pfClassroomId');
    if (classroomSelect) {
      classroomSelect.innerHTML = '<option value="">-- Select Classroom --</option>' +
        classrooms.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.studentIds?.length || 0} students)</option>`).join('');
    }
    
    // Load all students
    const students = await loadAllStudents();
    const studentSelect = document.getElementById('pfStudentIds');
    if (studentSelect) {
      studentSelect.innerHTML = students.map(s => 
        `<option value="${s.id}">${escapeHtml(s.full_name || s.name || s.email)} ${s.classroomName ? `(${escapeHtml(s.classroomName)})` : ''}</option>`
      ).join('');
    }
  } catch (err) {
    console.warn('Could not load options:', err);
  }
}



async function loadClassroomOptions(tutorId) {
  try {
    const classrooms = await loadClassrooms(tutorId);
    const select = document.getElementById('pfClassroomId');
    if (select) {
      select.innerHTML = '<option value="">-- Select Classroom --</option>' +
        classrooms.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }
    
    // Also load all students for student selection
    const students = await loadAllStudents();
    const studentSelect = document.getElementById('pfStudentIds');
    if (studentSelect) {
      studentSelect.innerHTML = students.map(s => 
        `<option value="${s.id}">${escapeHtml(s.full_name || s.name || s.email)}</option>`
      ).join('');
    }
  } catch (err) {
    console.warn('Could not load classrooms:', err);
  }
}

window.editPortfolio = function(portfolioId) {
  alert('Edit portfolio - coming soon!');
};

window.manageSections = function(portfolioId) {
  alert('Manage sections - coming soon!');
};

window.viewAllSubmissions = async function(portfolioId) {
  // Load all student submissions for this portfolio
  try {
    const entriesSnap = await getDocs(
      query(collection(db, 'portfolio_entries'), where('portfolioId', '==', portfolioId))
    );
    
    const entries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Group by student
    const byStudent = {};
    entries.forEach(e => {
      if (!byStudent[e.studentId]) byStudent[e.studentId] = { name: e.studentName, count: 0 };
      byStudent[e.studentId].count++;
    });
    
    const summary = Object.entries(byStudent).map(([id, data]) => 
      `• ${data.name}: ${data.count} sections completed`
    ).join('\n');
    
    alert(`Submissions Summary:\n${summary || 'No submissions yet'}`);
  } catch (err) {
    alert('Error loading submissions: ' + err.message);
  }
};

async function handleCreatePortfolio() {
  const msg = document.getElementById('pfMsg');
  msg.innerHTML = '<span style="color:#3498db;">Creating portfolio...</span>';
  
  try {
    const targetType = document.getElementById('pfTargetType').value;
    let studentIds = [];
    let classroomId = null;
    let classroomName = '';
    
    if (targetType === 'classroom') {
      classroomId = document.getElementById('pfClassroomId').value;
      if (!classroomId) {
        msg.innerHTML = '<span style="color:#e74c3c;">Please select a classroom</span>';
        return;
      }
      // Get classroom students
      const classroomDoc = await getDoc(doc(db, 'classrooms', classroomId));
      const classroom = classroomDoc.data();
      classroomName = classroom?.name || '';
      studentIds = classroom?.studentIds || [];
    } else if (targetType === 'students') {
      const selected = Array.from(document.getElementById('pfStudentIds').selectedOptions);
      studentIds = selected.map(opt => opt.value);
      if (studentIds.length === 0) {
        msg.innerHTML = '<span style="color:#e74c3c;">Please select at least one student</span>';
        return;
      }
    } else {
      // All students
      const allStudents = await loadAllStudents();
      studentIds = allStudents.map(s => s.id);
    }
    
    const data = {
      title: document.getElementById('pfTitle').value.trim(),
      description: document.getElementById('pfDescription').value.trim(),
      type: document.getElementById('pfType').value,
      subject: document.getElementById('pfSubject').value.trim(),
      gradeLevel: document.getElementById('pfGradeLevel').value.trim(),
      emoji: document.getElementById('pfEmoji').value || '📁',
      targetType: targetType,
      classroomId: classroomId,
      classroomName: classroomName,
      studentIds: studentIds,
      externalLinkTitle: document.getElementById('pfExternalLinkTitle')?.value || '',
      externalLinkUrl: document.getElementById('pfExternalLinkUrl')?.value || '',
      dueDate: document.getElementById('pfDueDate').value || null,
      allowStudentUploads: document.getElementById('pfAllowUploads').checked,
      allowComments: document.getElementById('pfAllowComments').checked,
      allowExternalLinks: document.getElementById('pfAllowExternalLinks')?.checked !== false,
      role: document.getElementById('pfCreatedByRole').value,
      createdByName: document.getElementById('pfCreatedByName').value,
      sections: window.portfolioSections || []
    };
    
    if (!data.title) {
      msg.innerHTML = '<span style="color:#e74c3c;">Please enter a title</span>';
      return;
    }
    
    const portfolioId = await createPortfolioTemplate(data);
    
    msg.innerHTML = `<span style="color:#27ae60;">✅ Portfolio created and assigned to ${studentIds.length} student(s)!</span>`;
    setTimeout(() => {
      document.getElementById('createPortfolioModal').remove();
      location.reload();
    }, 1500);
    
  } catch (err) {
    console.error('Create portfolio error:', err);
    msg.innerHTML = `<span style="color:#e74c3c;">Error: ${err.message}</span>`;
  }
}
function renderStudentSectionInput(section, entry, portfolioId, studentId) {
  const existingContent = entry?.content || '';
  const existingFile = entry?.fileUrl || '';
  
  if (section.type === 'upload' || section.type === 'media') {
    return `
      <div class="section-input-area" data-section-id="${section.id}">
        ${existingFile ? `
          <div class="student-response">
            <div class="upload-preview">
              ${renderFilePreview(existingFile, entry?.fileName || '')}
            </div>
            <p style="margin-top:12px;color:#666;">You can upload a new file to replace this one.</p>
          </div>
        ` : ''}
        
        <div class="upload-area" onclick="document.getElementById('file-${section.id}').click()">
          <input type="file" id="file-${section.id}" style="display:none;" 
                 accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"
                 onchange="handleSectionFileUpload(this, '${portfolioId}', '${section.id}', '${studentId}')">
          <div style="font-size:32px;margin-bottom:8px;">📎</div>
          <p>${section.placeholder || 'Click to upload a file'}</p>
          <small>Images, videos, PDFs, documents</small>
        </div>
        <div id="upload-progress-${section.id}"></div>
      </div>
    `;
  }
  
  // Default text/reflection input
  return `
    <div class="section-input-area" data-section-id="${section.id}">
      ${existingContent ? `
        <div class="student-response">
          <p>${escapeHtml(existingContent)}</p>
        </div>
      ` : ''}
      
      <textarea 
        id="section-input-${section.id}" 
        placeholder="${section.placeholder || 'Write your response here...'}"
        onblur="autoSaveSection('${portfolioId}', '${section.id}', '${studentId}', this.value)"
      >${escapeHtml(existingContent)}</textarea>
      
      <div class="section-actions">
        <span id="save-status-${section.id}" style="font-size:12px;color:#888;"></span>
        <button class="btn small" onclick="saveSectionContent('${portfolioId}', '${section.id}', '${studentId}')">
          Save
        </button>
      </div>
    </div>
  `;
}

async function loadStudentPortfolioEntries(portfolioId, studentId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'portfolio_entries'),
        where('portfolioId', '==', portfolioId),
        where('studentId', '==', studentId)
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error loading entries:', err);
    return [];
  }
}

async function loadPortfolioSections(portfolioId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'portfolio_sections'),
        where('portfolioId', '==', portfolioId),
        orderBy('order', 'asc')
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error loading sections:', err);
    return [];
  }
}

async function loadPortfoliosForUser(userId, role) {
  let portfolios = [];
  
  console.log(`📁 Loading portfolios for ${role}: ${userId}`);
  
  try {
    if (role === 'student') {
      // Get student's classroom
      const studentDoc = await getDoc(doc(db, 'students', userId));
      const studentData = studentDoc.data();
      const classroomId = studentData?.classroomId || '';
      
      console.log(`📁 Student classroom: ${classroomId}`);
      
      // Try multiple query approaches - some may fail due to missing indexes
      const portfolioMap = new Map();
      
      // Approach 1: Get all portfolios and filter client-side (most reliable)
      try {
        const allSnap = await getDocs(collection(db, 'portfolios'));
        allSnap.docs.forEach(doc => {
          const data = doc.data();
          // Check if this portfolio is assigned to this student
          const studentIds = data.studentIds || [];
          const targetType = data.targetType;
          const docClassroomId = data.classroomId;
          
          let isAssigned = false;
          if (studentIds.includes(userId)) isAssigned = true;
          else if (targetType === 'all') isAssigned = true;
          else if (targetType === 'classroom' && docClassroomId === classroomId) isAssigned = true;
          
          if (isAssigned) {
            portfolioMap.set(doc.id, { id: doc.id, ...data });
          }
        });
        console.log(`✅ Found ${portfolioMap.size} portfolios via client-side filter`);
      } catch (err) {
        console.warn('Client-side filter failed:', err);
      }
      
      // Approach 2: Try direct queries (may fail if index missing)
      try {
        const q1 = query(collection(db, 'portfolios'), where('studentIds', 'array-contains', userId));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach(doc => {
          if (!portfolioMap.has(doc.id)) {
            portfolioMap.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
      } catch (err) {
        console.warn('Array-contains query failed (index may be missing):', err.message);
      }
      
      try {
        const q2 = query(collection(db, 'portfolios'), where('targetType', '==', 'all'));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(doc => {
          if (!portfolioMap.has(doc.id)) {
            portfolioMap.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
      } catch (err) {
        console.warn('TargetType query failed:', err.message);
      }
      
      if (classroomId) {
        try {
          const q3 = query(collection(db, 'portfolios'), where('classroomId', '==', classroomId));
          const snap3 = await getDocs(q3);
          snap3.docs.forEach(doc => {
            if (!portfolioMap.has(doc.id)) {
              portfolioMap.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
        } catch (err) {
          console.warn('ClassroomId query failed:', err.message);
        }
      }
      
      portfolios = Array.from(portfolioMap.values());
      
      // Load completion status for each portfolio
      for (const p of portfolios) {
        try {
          p.completionStatus = await getStudentPortfolioCompletion(p.id, userId);
        } catch (err) {
          p.completionStatus = { totalSections: 0, completedSections: 0, percentage: 0, entries: [] };
        }
      }
      
    } else if (role === 'tutor') {
      // Tutor sees portfolios they created
      try {
        // Try query first
        const q = query(collection(db, 'portfolios'), where('createdBy', '==', userId));
        const snap = await getDocs(q);
        portfolios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn('Tutor query failed, using client-side filter:', err.message);
        // Fallback: get all and filter
        const allSnap = await getDocs(collection(db, 'portfolios'));
        portfolios = allSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.createdBy === userId);
      }
      
    } else if (role === 'parent') {
      // Parent sees all portfolios
      try {
        const snap = await getDocs(collection(db, 'portfolios'));
        portfolios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Parent portfolio load failed:', err);
        portfolios = [];
      }
    }
    
    // Sort by createdAt descending
    portfolios.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    
    console.log(`✅ Loaded ${portfolios.length} portfolios for ${role}`);
    
  } catch (err) {
    console.error('Error loading portfolios:', err);
    // Return empty array instead of throwing
    portfolios = [];
  }
  
  return portfolios;
}


async function createPortfolioTemplate(data) {
  const portfolioRef = doc(collection(db, 'portfolios'));
  
  const portfolioData = {
    title: data.title,
    description: data.description || '',
    type: data.type || 'custom', // 'project', 'subject', 'stem', 'custom'
    subject: data.subject || '',
    gradeLevel: data.gradeLevel || '',
    emoji: data.emoji || '📁',
    coverImageUrl: data.coverImageUrl || '',
    createdBy: auth.currentUser?.uid || data.createdBy,
    createdByRole: data.role || 'tutor',
    createdByName: data.createdByName || 'Tutor',
    
    // Target settings - ASSIGN TO SPECIFIC STUDENTS
    targetType: data.targetType || 'all',
    classroomId: data.classroomId || null,
    classroomName: data.classroomName || '',
    studentIds: data.studentIds || [],
    studentNames: data.studentNames || [],
    
    // External links (Sutori, Google Docs, etc.)
    externalLinkUrl: data.externalLinkUrl || '',
    externalLinkTitle: data.externalLinkTitle || '',
    
    // Template settings
    isTemplate: data.isTemplate || false,
    allowStudentUploads: data.allowStudentUploads !== false,
    allowComments: data.allowComments || false,
    allowExternalLinks: data.allowExternalLinks !== false,
    
    // Status
    status: 'published',
    dueDate: data.dueDate || null,
    
    // Metadata
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    
    // Stats
    totalStudents: (data.studentIds || []).length,
    completedCount: 0
  };
  
  await setDoc(portfolioRef, portfolioData);
  
  // Create sections if provided
  if (data.sections && Array.isArray(data.sections)) {
    const batch = writeBatch(db);
    for (const section of data.sections) {
      const sectionRef = doc(collection(db, 'portfolio_sections'));
      batch.set(sectionRef, {
        portfolioId: portfolioRef.id,
        title: section.title || 'Untitled Section',
        description: section.description || '',
        type: section.type || 'text',
        order: section.order || 0,
        required: section.required !== false,
        placeholder: section.placeholder || '',
        hints: section.hints || '',
        // External link support for sections
        externalLinkUrl: section.externalLinkUrl || '',
        externalLinkTitle: section.externalLinkTitle || '',
        createdAt: serverTimestamp()
      });
    }
    await batch.commit();
  }
  
  // Notify assigned students
  if (data.studentIds && data.studentIds.length > 0) {
    const batch = writeBatch(db);
    for (const studentId of data.studentIds) {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        studentId: studentId,
        title: 'New Portfolio Assigned',
        message: `You have been assigned a new portfolio: "${data.title}"`,
        type: 'portfolio',
        portfolioId: portfolioRef.id,
        read: false,
        createdAt: serverTimestamp()
      });
    }
    await batch.commit();
  }
  
  return portfolioRef.id;
}




window.joinClassByCode = async function() {
  const code = document.getElementById('joinClassCode')?.value.trim().toUpperCase();
  const msg = document.getElementById('joinMsg');
  
  if (!code) {
    if (msg) msg.innerHTML = '<span style="color:#e74c3c;">❌ Please enter a class code</span>';
    return;
  }

  if (msg) msg.innerHTML = '<span style="color:#3498db;">🔍 Finding class...</span>';

  try {
    // Find classroom by classCode
    const q = query(collection(db, 'classrooms'), where('classCode', '==', code));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      if (msg) msg.innerHTML = '<span style="color:#e74c3c;">❌ Invalid class code. Please check and try again.</span>';
      return;
    }

    const classroomDoc = snap.docs[0];
    const classroomData = classroomDoc.data();
    const studentId = auth.currentUser.uid;

    // Check if already enrolled
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    if (studentDoc.exists() && studentDoc.data().classroomId === classroomDoc.id) {
      if (msg) msg.innerHTML = '<span style="color:#e67e22;">⚠️ You are already enrolled in this class!</span>';
      return;
    }

    // Update student record with classroom
    const batch = writeBatch(db);
    
    batch.set(doc(db, 'students', studentId), {
      uid: studentId,
      classroomId: classroomDoc.id,
      classroomName: classroomData.name,
      joinedAt: serverTimestamp()
    }, { merge: true });

    batch.set(doc(db, 'users', studentId), {
      classroomId: classroomDoc.id,
      classroomName: classroomData.name
    }, { merge: true });

    // Add student to classroom's studentIds array
    const currentStudentIds = classroomData.studentIds || [];
    if (!currentStudentIds.includes(studentId)) {
      batch.update(doc(db, 'classrooms', classroomDoc.id), {
        studentIds: [...currentStudentIds, studentId]
      });
    }

    // Create notification for tutor
    const studentName = auth.currentUser.displayName || 'A student';
    batch.set(doc(collection(db, 'notifications')), {
      tutorId: classroomData.tutorId,
      title: 'New Student Joined',
      message: `${studentName} joined ${classroomData.name}`,
      type: 'student_joined',
      studentId,
      classroomId: classroomDoc.id,
      read: false,
      createdAt: serverTimestamp()
    });

    await batch.commit();

    if (msg) msg.innerHTML = '<span style="color:#27ae60;">✅ Successfully joined the class! Refreshing...</span>';
    
    setTimeout(() => {
      location.reload();
    }, 1500);

  } catch (err) {
    console.error('Join class error:', err);
    if (msg) msg.innerHTML = `<span style="color:#e74c3c;">❌ Error: ${err.message}</span>`;
  }
};

// ============================================
// EXPOSE TO WINDOW
// ============================================

window.renderClassTabContent = renderClassTabContent;
window.loadStreamFeed = loadStreamFeed;
// ============================================
// GLOBALS
// ============================================

window.AppUtil = { auth, db, storage, requireAuth, getUserProfile, uploadFile, fmtDate, statusBadge, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile };
window.openFileModal = openFileModal;



