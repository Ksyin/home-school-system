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
      const milestone = document.getElementById('portfolioMilestone')?.value || '';
      
      if (!title || !note) {
        document.getElementById('portfolioMsg').innerHTML = '<span style="color:#e74c3c;">❌ Please add a title and reflection</span>';
        return;
      }
      
      document.getElementById('portfolioMsg').innerHTML = '<span style="color:#3498db;">⏳ Saving your journey entry...</span>';
      
      try {
        let upload = { url: '', name: '' };
        if (file) {
          upload = await uploadFile(file, `portfolio/${user.uid}`);
        }
        
        await addDoc(collection(db, 'portfolio'), {
          studentId: user.uid,
          studentName: getStudentDisplayName(profile, user),
          type: type,
          title: title,
          note: note,
          feeling: feeling,
          milestone: milestone,
          fileUrl: upload.url,
          fileName: upload.name,
          createdAt: serverTimestamp()
        });
        
        document.getElementById('portfolioMsg').innerHTML = '<span style="color:#27ae60;">✅ Entry saved! Refreshing...</span>';
        form.reset();
        setTimeout(() => bootStudentPortfolioPage(), 1500);
      } catch (err) {
        document.getElementById('portfolioMsg').innerHTML = `<span style="color:#e74c3c;">❌ Error: ${err.message}</span>`;
      }
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
  
  const { user } = bundle;
  const [students, assignments, assessments, classrooms] = await Promise.all([
    loadAllStudents(),
    loadTutorAssignments(user.uid),
    loadTutorAssessments(user.uid),
    loadClassrooms(user.uid)
  ]);
  
  document.getElementById('page-content').innerHTML = renderTutorDashboard(students, assignments, assessments, classrooms);
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
