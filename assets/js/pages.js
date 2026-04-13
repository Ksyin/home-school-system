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

// ============================================
// UPDATED: Assignment Visibility for Student
// ============================================

function assignmentVisibleToStudent(assignment, studentUid, studentClassroomId = null) {
  if (!assignment) return false;
  
  // Direct assignment
  if (assignment.studentId && assignment.studentId === studentUid) return true;
  
  // Array assignments
  if (Array.isArray(assignment.studentIds) && assignment.studentIds.includes(studentUid)) return true;
  if (Array.isArray(assignment.assignedTo) && assignment.assignedTo.includes(studentUid)) return true;
  
  // Classroom assignment
  if (studentClassroomId && assignment.classroomId === studentClassroomId) return true;
  
  // All students
  if (assignment.targetType === 'all_students' || assignment.targetType === 'all') return true;
  if (assignment.published === true && !assignment.studentId && !assignment.classroomId) return true;
  
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
  
  try {
    // Get student's classroom
    const studentDoc = await getDoc(doc(db, 'students', studentUid));
    const studentData = studentDoc.data();
    const classroomId = studentData?.classroomId || '';
    
    const assignmentsSnap = await getDocs(collection(db, 'assignments'));
    const assignments = [];
    
    for (const docSnap of assignmentsSnap.docs) {
      const assignment = { id: docSnap.id, ...docSnap.data() };
      
      if (assignmentVisibleToStudent(assignment, studentUid, classroomId)) {
        assignments.push(assignment);
      }
    }
    
    // Sort by due date (closest first) then by created date
    assignments.sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
    
    console.log(`✅ Found ${assignments.length} assignments for student`);
    return assignments;
  } catch (err) {
    console.error('Error loading student assignments:', err);
    return [];
  }
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


let attendanceInterval = null;
let sessionStartTime = null;

function startAttendanceTracking(userId, role) {
  // Clear any existing tracking
  if (attendanceInterval) {
    clearInterval(attendanceInterval);
  }
  
  // Set session start
  sessionStartTime = Date.now();
  localStorage.setItem(`sessionStart_${userId}`, sessionStartTime.toString());
  
  console.log(`⏰ Attendance tracking started for ${userId} (${role})`);
  
  // Update heartbeat every 30 seconds
  attendanceInterval = setInterval(() => {
    localStorage.setItem(`lastActivity_${userId}`, Date.now().toString());
    console.log(`💓 Heartbeat: ${userId}`);
  }, 30000);
  
  // Save attendance on page unload
  window.addEventListener('beforeunload', async () => {
    await saveAttendanceOnExit(userId, role);
  });
  
  // Also save when page becomes hidden (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveAttendanceOnExit(userId, role);
    }
  });
  
  return attendanceInterval;
}

async function saveAttendanceOnExit(userId, role) {
  if (!sessionStartTime) return;
  
  const startTime = parseInt(localStorage.getItem(`sessionStart_${userId}`) || sessionStartTime);
  const endTime = Date.now();
  const durationMinutes = Math.round((endTime - startTime) / 60000);
  
  // Only log if active for at least 1 minute
  if (durationMinutes >= 1) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if attendance already recorded for today
      const existingQuery = query(
        collection(db, 'attendance'),
        where('studentId', '==', userId),
        where('date', '==', today)
      );
      const existingSnap = await getDocs(existingQuery);
      
      if (existingSnap.empty) {
        await addDoc(collection(db, 'attendance'), {
          studentId: userId,
          studentRole: role,
          loginTime: new Date(startTime).toISOString(),
          logoutTime: new Date(endTime).toISOString(),
          durationMinutes: durationMinutes,
          status: 'Present',
          recordedAutomatically: true,
          createdAt: serverTimestamp(),
          date: today
        });
        console.log(`✅ Attendance logged: ${durationMinutes} minutes for ${userId}`);
      } else {
        // Update existing record
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();
        await updateDoc(doc(db, 'attendance', existingDoc.id), {
          durationMinutes: (existingData.durationMinutes || 0) + durationMinutes,
          logoutTime: new Date(endTime).toISOString(),
          updatedAt: serverTimestamp()
        });
        console.log(`📝 Attendance updated: +${durationMinutes} minutes for ${userId}`);
      }
    } catch (err) {
      console.error('Failed to log attendance:', err);
    }
  }
  
  // Clean up
  if (attendanceInterval) {
    clearInterval(attendanceInterval);
    attendanceInterval = null;
  }
  localStorage.removeItem(`sessionStart_${userId}`);
  localStorage.removeItem(`lastActivity_${userId}`);
  sessionStartTime = null;
}


async function loadSubmissionsForAssignment(assignmentId) {
  const q = query(
    collection(db, 'submissions'),
    where('assignmentId', '==', assignmentId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

async function loadAllSubmissionsForTutor(tutorUid) {
  // First get all assignments by this tutor
  const assignmentsSnap = await getDocs(
    query(collection(db, 'assignments'), where('tutorId', '==', tutorUid))
  );
  const assignmentIds = assignmentsSnap.docs.map(d => d.id);
  
  if (assignmentIds.length === 0) return [];
  
  // Get all submissions for these assignments
  const submissions = [];
  for (const assignmentId of assignmentIds) {
    const subs = await loadSubmissionsForAssignment(assignmentId);
    submissions.push(...subs);
  }
  
  return submissions.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
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




async function bootParentSuperDashboard() {
  const bundle = await requireAuth();
  if (!bundle || bundle.profile?.role !== 'parent') return;
  
  const { user, profile } = bundle;
  
  // Load ALL data from the entire system
  const [
    allStudents, 
    allTutors, 
    allAssignments, 
    allAssessments, 
    allSubmissions, 
    allAttendance, 
    allResources, 
    allPortfolios, 
    allReports, 
    allMessages,
    allClassrooms
  ] = await Promise.all([
    loadAllUsersByRole('student'),
    loadAllUsersByRole('tutor'),
    loadAllAssignments(),
    loadAllAssessments(),
    loadAllSubmissions(),
    loadAllAttendance(),
    loadAllResources(),
    loadAllPortfolios(),
    loadAllReports(),
    loadAllMessages(),
    loadAllClassrooms()
  ]);
  
  // Calculate comprehensive stats
  const totalStudents = allStudents.length;
  const totalTutors = allTutors.length;
  const totalAssignments = allAssignments.length;
  const totalAssessments = allAssessments.length;
  const totalSubmissions = allSubmissions.length;
  const pendingAssignments = allAssignments.filter(a => {
    const hasSubmission = allSubmissions.some(s => s.assignmentId === a.id);
    return !hasSubmission;
  }).length;
  const pendingAssessments = allAssessments.filter(a => a.status !== 'Graded').length;
  const unreadMessages = allMessages.filter(m => !m.read).length;
  
  // Calculate submission rate
  const submissionRate = totalAssignments > 0 
    ? Math.round((totalSubmissions / totalAssignments) * 100) 
    : 0;
  
  // Calculate subject performance across all students
  const subjectPerformance = {};
  allAssessments.forEach(a => {
    if (a.subject && a.score && a.maxScore) {
      if (!subjectPerformance[a.subject]) {
        subjectPerformance[a.subject] = { totalScore: 0, totalMax: 0, count: 0 };
      }
      subjectPerformance[a.subject].totalScore += a.score;
      subjectPerformance[a.subject].totalMax += a.maxScore;
      subjectPerformance[a.subject].count++;
    }
  });
  
  const subjectsHtml = Object.entries(subjectPerformance)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([subject, data]) => {
      const percentage = Math.round((data.totalScore / data.totalMax) * 100);
      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <strong>${escapeHtml(subject)}</strong>
            <span>${percentage}% (${data.count} assessments)</span>
          </div>
          <div class="progress-bar" style="background:#ecf0f1;height:8px;border-radius:4px;overflow:hidden">
            <div style="width:${percentage}%;background:${percentage >= 70 ? '#27ae60' : (percentage >= 50 ? '#f39c12' : '#e74c3c')};height:8px;"></div>
          </div>
        </div>
      `;
    }).join('');
  
  // Recent activity feed - comprehensive
  const recentActivities = [
    ...allAssignments.map(a => ({ 
      type: '📝 Assignment', 
      title: a.title, 
      date: a.createdAt, 
      actor: a.tutorName || 'Tutor',
      target: a.studentName || a.classroomName || 'All Students',
      details: a.dueDate ? `Due: ${fmtDate(a.dueDate)}` : ''
    })),
    ...allAssessments.map(a => ({ 
      type: '📊 Assessment', 
      title: a.title, 
      date: a.createdAt, 
      actor: a.tutorName || 'Tutor',
      target: a.studentName || 'Student',
      details: a.score ? `Score: ${a.score}/${a.maxScore}` : 'Pending grading'
    })),
    ...allSubmissions.map(s => ({ 
      type: '✅ Submission', 
      title: s.assignmentTitle, 
      date: s.submittedAt, 
      actor: s.studentName || 'Student',
      target: 'Assignment',
      details: s.fileUrl ? 'File attached' : 'No file'
    })),
    ...allAttendance.filter(a => a.recordedAutomatically).slice(0, 10).map(a => ({
      type: '⏰ Attendance',
      title: `${a.durationMinutes || 0} minutes`,
      date: a.createdAt,
      actor: a.studentId,
      target: 'System',
      details: `Active session logged`
    }))
  ].sort((a, b) => {
    const aTime = a.date?.seconds || 0;
    const bTime = b.date?.seconds || 0;
    return bTime - aTime;
  }).slice(0, 15);
  
  const activityHtml = recentActivities.map(a => `
    <div style="padding:12px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px">
      <span style="font-size:20px;">${a.type.split(' ')[0]}</span>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between">
          <strong>${escapeHtml(a.title)}</strong>
          <small>${fmtDate(a.date)}</small>
        </div>
        <div style="display:flex;gap:16px;font-size:13px;color:#666">
          <span>By: ${escapeHtml(a.actor)}</span>
          ${a.target ? `<span>For: ${escapeHtml(a.target)}</span>` : ''}
          ${a.details ? `<span>${escapeHtml(a.details)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
  
  // Student summary cards
  const studentCards = allStudents.slice(0, 6).map(student => {
    const studentSubmissions = allSubmissions.filter(s => s.studentId === student.id);
    const studentAssessments = allAssessments.filter(a => a.studentId === student.id);
    const studentAttendance = allAttendance.filter(a => a.studentId === student.id);
    const avgScore = studentAssessments.length > 0 
      ? Math.round(studentAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / studentAssessments.length)
      : 0;
    
    return `
      <div style="background:white;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:16px">${escapeHtml(student.full_name || student.name || student.email)}</strong>
          <span class="badge">${escapeHtml(student.classroomName || 'Unassigned')}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
          <div style="text-align:center"><div style="font-size:18px;font-weight:bold">${studentSubmissions.length}</div><small>Submitted</small></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:bold">${studentAssessments.length}</div><small>Assessments</small></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:bold">${avgScore}%</div><small>Avg Score</small></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:bold">${studentAttendance.length}</div><small>Attendance</small></div>
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('page-content').innerHTML = `
    <style>
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px; }
      .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .stat-number { font-size: 32px; font-weight: bold; margin: 0; }
      .stat-label { color: #666; font-size: 14px; margin-top: 4px; }
      .dashboard-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; }
      @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
    </style>
    
    <!-- Key Stats -->
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${totalStudents}</div><div class="stat-label">Students</div></div>
      <div class="stat-card"><div class="stat-number">${totalTutors}</div><div class="stat-label">Tutors</div></div>
      <div class="stat-card"><div class="stat-number">${totalAssignments}</div><div class="stat-label">Assignments</div></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingAssignments}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-number">${totalAssessments}</div><div class="stat-label">Assessments</div></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingAssessments}</div><div class="stat-label">Ungraded</div></div>
      <div class="stat-card"><div class="stat-number">${submissionRate}%</div><div class="stat-label">Submission Rate</div></div>
      <div class="stat-card"><div class="stat-number">${unreadMessages}</div><div class="stat-label">Unread Messages</div></div>
    </div>
    
    <!-- Main Dashboard Grid -->
    <div class="dashboard-grid">
      <!-- Left Column - Performance & Activity -->
      <div>
        <div class="card panel" style="margin-bottom:24px;">
          <h3>📊 Subject Performance Overview</h3>
          ${subjectsHtml || '<p class="empty">No assessment data available yet</p>'}
        </div>
        
        <div class="card panel">
          <h3>🔄 Recent System Activity</h3>
          <div style="max-height:400px;overflow-y:auto">
            ${activityHtml || '<p class="empty">No recent activity</p>'}
          </div>
        </div>
      </div>
      
      <!-- Right Column - Quick Actions & Alerts -->
      <div>
        <div class="card panel" style="margin-bottom:24px;">
          <h3>⚡ Quick Actions</h3>
          <div style="display:grid;gap:12px">
            <a href="/parent/children.html" class="btn">👥 View All Students</a>
            <a href="/parent/assignments.html" class="btn ghost">📝 All Assignments</a>
            <a href="/parent/assessments.html" class="btn ghost">📊 All Assessments</a>
            <a href="/parent/attendance.html" class="btn ghost">📅 Attendance Records</a>
            <a href="/parent/messages.html" class="btn ghost">💬 Messages (${unreadMessages} unread)</a>
            <a href="/parent/resources.html" class="btn ghost">📚 Learning Resources</a>
          </div>
        </div>
        
        <div class="card panel">
          <h3>📋 Pending Items</h3>
          ${pendingAssignments > 0 ? `
            <div style="background:#fff3e0;padding:12px;border-radius:8px;margin-bottom:12px">
              <strong>📝 ${pendingAssignments} assignments pending submission</strong>
            </div>
          ` : ''}
          ${pendingAssessments > 0 ? `
            <div style="background:#fff3e0;padding:12px;border-radius:8px;margin-bottom:12px">
              <strong>📊 ${pendingAssessments} assessments need grading</strong>
            </div>
          ` : ''}
          ${unreadMessages > 0 ? `
            <div style="background:#e3f2fd;padding:12px;border-radius:8px">
              <strong>💬 ${unreadMessages} unread messages</strong>
            </div>
          ` : ''}
          ${pendingAssignments === 0 && pendingAssessments === 0 && unreadMessages === 0 ? `
            <p class="empty" style="color:#27ae60;">✨ All caught up!</p>
          ` : ''}
        </div>
      </div>
    </div>
    
    <!-- Student Overview Cards -->
    <div class="card panel" style="margin-top:24px;">
      <h3>👥 Student Overview</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-top:16px">
        ${studentCards || '<p class="empty">No students registered yet</p>'}
      </div>
      ${allStudents.length > 6 ? `
        <div style="margin-top:16px;text-align:center">
          <a href="/parent/children.html" class="btn ghost">View All ${allStudents.length} Students →</a>
        </div>
      ` : ''}
    </div>
    
    <!-- Recent Submissions -->
    <div class="card panel" style="margin-top:24px;">
      <h3>📤 Recent Submissions</h3>
      ${allSubmissions.slice(0, 5).map(s => `
        <div style="padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${escapeHtml(s.studentName)}</strong> submitted 
            <strong>${escapeHtml(s.assignmentTitle)}</strong>
            <br><small>${fmtDate(s.submittedAt)}</small>
          </div>
          ${s.fileUrl ? `<a href="${s.fileUrl}" target="_blank" class="btn small ghost">View File</a>` : '<span class="badge">No file</span>'}
        </div>
      `).join('') || '<p class="empty">No submissions yet</p>'}
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
  
  // Start attendance tracking
  startAttendanceTracking(user.uid, 'student');
  
  try {
    const [
      assignments, 
      submissions, 
      assessments, 
      notifications, 
      portfolioItems, 
      resources,
      attendance
    ] = await Promise.all([
      loadStudentAssignments(user.uid),
      loadStudentSubmissions(user.uid),
      loadStudentAssessments(user.uid),
      loadStudentNotifications(user.uid),
      loadStudentPortfolio(user.uid),
      loadStudentResources(user.uid),
      loadStudentAttendance(user.uid)
    ]);
    
    document.getElementById('page-content').innerHTML = renderStudentDashboard(
      profile, assignments, submissions, assessments, 
      notifications, portfolioItems, resources, attendance
    );
    
    // Mark notifications as read when clicked
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
    document.getElementById('page-content').innerHTML = `
      <div class="card panel error">
        <h3>⚠️ Unable to load dashboard</h3>
        <p>${err.message}</p>
        <button class="btn" onclick="location.reload()">Try Again</button>
      </div>
    `;
  }
}

// Updated renderStudentDashboard with attendance
function renderStudentDashboard(profile, assignments, submissions, assessments, notifications, portfolioItems, resources, attendance) {
  const pendingAssignments = assignments.filter(a => !submissions.find(s => s.assignmentId === a.id)).length;
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const gradedAssessments = assessments.filter(a => a.status === 'Graded').length;
  
  // Calculate attendance stats
  const presentDays = attendance.filter(a => a.status === 'Present' || a.status === 'present').length;
  const totalMinutes = attendance.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
  const avgMinutes = attendance.length > 0 ? Math.round(totalMinutes / attendance.length) : 0;
  
  return `
    <style>
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 24px; }
      .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .stat-number { font-size: 32px; font-weight: bold; margin: 0; }
      .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
      .notification-item { padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; }
      .notification-item.unread { background: #f0f7ff; border-left: 3px solid #3498db; }
      .notification-item:hover { background: #e8f0fe; }
      .progress-bar { background: #ecf0f1; border-radius: 10px; overflow: hidden; height: 8px; }
    </style>
    
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${assignments.length}</div><p>Assignments</p></div>
      <div class="stat-card" style="background:#e8f5e9;"><div class="stat-number">${submissions.length}</div><p>Completed</p></div>
      <div class="stat-card" style="background:#fff3e0;"><div class="stat-number">${pendingAssignments}</div><p>Pending</p></div>
      <div class="stat-card" style="background:#e3f2fd;"><div class="stat-number">${gradedAssessments}</div><p>Graded</p></div>
      <div class="stat-card"><div class="stat-number">${resources.length}</div><p>Resources</p></div>
      <div class="stat-card" style="background:#f3e5f5;"><div class="stat-number">${presentDays}</div><p>Days Present</p></div>
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
        <h3>⏰ Attendance Summary</h3>
        <div style="text-align:center;padding:20px">
          <div style="font-size:48px;font-weight:bold;color:#3498db">${presentDays}</div>
          <p>Days Present</p>
          <hr>
          <div style="display:flex;justify-content:space-around">
            <div><strong>${totalMinutes}</strong><br><small>Total Minutes</small></div>
            <div><strong>${avgMinutes}</strong><br><small>Avg per Day</small></div>
          </div>
        </div>
        ${attendance.length > 0 ? `
          <div style="margin-top:12px">
            <h4>Recent Attendance</h4>
            ${attendance.slice(0, 3).map(a => `
              <div style="padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between">
                <span>${fmtDate(a.date || a.createdAt)}</span>
                <span>${statusBadge(a.status || 'Present')}</span>
                <span>${a.durationMinutes || 0} min</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>📝 Recent Assignments</h3>
      ${assignments.slice(0, 5).map(a => {
        const submitted = submissions.find(s => s.assignmentId === a.id);
        return `
          <div style="padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong>${escapeHtml(a.title)}</strong>
              <br><small>Due: ${fmtDate(a.dueDate)}</small>
            </div>
            ${submitted ? '<span class="badge success">✓ Submitted</span>' : `<a href="/student/submit-work.html?assignmentId=${a.id}" class="btn small">Submit</a>`}
          </div>
        `;
      }).join('') || '<p class="empty">No assignments</p>'}
      <div style="margin-top:12px;text-align:center;">
        <a href="/student/assignments.html" class="btn ghost">View All →</a>
      </div>
    </div>
    
    <div class="card panel" style="margin-top:24px;">
      <h3>📊 Recent Assessments</h3>
      ${assessments.slice(0, 3).map(a => `
        <div style="padding:12px;border-bottom:1px solid #eee;">
          <div style="display:flex;justify-content:space-between;">
            <strong>${escapeHtml(a.title)}</strong>
            ${a.score ? `<span class="badge success">${a.score}/${a.maxScore}</span>` : '<span class="badge warn">Pending</span>'}
          </div>
          <small>${fmtDate(a.createdAt)}</small>
          ${a.feedback ? `<p style="margin:8px 0 0;font-size:13px;background:#f0f7ff;padding:8px;border-radius:4px;">💬 ${escapeHtml(a.feedback.substring(0, 100))}${a.feedback.length > 100 ? '...' : ''}</p>` : ''}
        </div>
      `).join('') || '<p class="empty">No assessments</p>'}
    </div>
  `;
}

// ============================================
// EXPOSE GLOBALS
// ============================================

window.startAttendanceTracking = startAttendanceTracking;
window.saveAttendanceOnExit = saveAttendanceOnExit;

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
  
  document.getElementById('page-content').innerHTML = renderSubmitWorkPage(profile, user, assignments, submissions);
  
  if (forcedId && document.getElementById('assignmentId')) {
    document.getElementById('assignmentId').value = forcedId;
  }
  
  const form = document.getElementById('submissionForm');
  const msg = document.getElementById('submitWorkMsg');
  const submitBtn = document.getElementById('submitWorkBtn');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const assignmentId = document.getElementById('assignmentId').value;
      const note = document.getElementById('submissionNote')?.value || '';
      const fileInput = document.getElementById('submissionFile');
      const file = fileInput?.files[0];
      
      if (!assignmentId) {
        msg.innerHTML = '<span style="color:red;">❌ Please select an assignment</span>';
        return;
      }
      
      if (submitBtn) submitBtn.disabled = true;
      msg.innerHTML = '<span style="color:blue;">⏳ Uploading submission...</span>';
      
      try {
        const assignmentDoc = await getDoc(doc(db, 'assignments', assignmentId));
        const assignment = assignmentDoc.data();
        
        let uploadResult = { url: '', name: '', path: '' };
        if (file) {
          uploadResult = await uploadFile(file, `submissions/${user.uid}/${assignmentId}`);
        }
        
        // Create submission
        await addDoc(collection(db, 'submissions'), {
          assignmentId,
          assignmentTitle: assignment?.title || 'Assignment',
          subject: assignment?.subject || '',
          studentId: user.uid,
          studentName: getStudentDisplayName(profile, user),
          note,
          fileUrl: uploadResult.url,
          fileName: uploadResult.name,
          filePath: uploadResult.path,
          status: 'Submitted',
          submittedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        
        // Update assignment status if needed
        await updateDoc(doc(db, 'assignments', assignmentId), {
          lastSubmissionAt: serverTimestamp(),
          hasSubmissions: true
        });
        
        // Create notification for tutor
        if (assignment?.tutorId) {
          await addDoc(collection(db, 'notifications'), {
            tutorId: assignment.tutorId,
            studentId: user.uid,
            studentName: getStudentDisplayName(profile, user),
            title: 'New Assignment Submission',
            message: `${getStudentDisplayName(profile, user)} submitted ${assignment?.title || 'an assignment'}`,
            type: 'submission',
            assignmentId,
            read: false,
            createdAt: serverTimestamp()
          });
        }
        
        msg.innerHTML = '<span style="color:green;">✅ Work submitted successfully! Refreshing...</span>';
        
        // Clear form
        form.reset();
        
        setTimeout(() => {
          bootSubmitWorkPage(); // Refresh the page
        }, 1500);
        
      } catch (err) {
        console.error('Submission error:', err);
        msg.innerHTML = `<span style="color:red;">❌ Error: ${err.message}</span>`;
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
