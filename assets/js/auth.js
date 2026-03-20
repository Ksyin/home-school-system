// ================================================
// FILE: auth.js
// PURPOSE: Handles login, registration, and forgot password
// ================================================

// IMPORTANT CHANGE: Use pages.js instead of app.js
// This ensures we use the SAME Firebase initialization & auth instance
// as the rest of the protected pages (dashboard, submit-work, etc.)
import './pages.js';

// Use window.FB (what pages.js exposes)
const { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile,
  setDoc,
  doc,
  serverTimestamp
} = window.FB;

const loginForm    = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotForm   = document.getElementById('forgotForm');
const notice       = document.getElementById('notice');

const show = (msg, err = false) => {
  if (notice) {
    notice.textContent = msg;
    notice.style.color = err ? '#b91c1c' : '#1d4ed8';
  } else {
    console.log(msg); // fallback if notice element missing
  }
};

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value.trim();

      const res = await signInWithEmailAndPassword(auth, email, password);

      // Simple redirect based on role (you can improve this later)
      const userDoc = await getDoc(doc(window.FB.db, 'users', res.user.uid));
      const role = userDoc.exists() ? userDoc.data().role : 'student';

      show('Login successful. Redirecting...');
      setTimeout(() => {
        location.href = `/${role}/dashboard.html`;
      }, 800);
    } catch (err) {
      show(err.message || 'Login failed', true);
      console.error('Login error:', err);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();

    const fullName   = registerForm.fullName?.value?.trim() || '';
    const email      = registerForm.email.value.trim();
    const password   = registerForm.password.value.trim();
    const role       = registerForm.role.value;
    const phone      = registerForm.phone?.value?.trim() || '';
    const accessCode = registerForm.accessCode?.value?.trim() || '';

    if (role === 'tutor' && accessCode !== 'TUTOR2026') {
      return show('Tutor access code is invalid. Default code in demo is TUTOR2026.', true);
    }

    if (!email || !password || !role) {
      return show('Email, password and role are required', true);
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);

      // Update Firebase Auth display name
      if (fullName) {
        await updateProfile(res.user, { displayName: fullName });
      }

      // Save to Firestore
      await setDoc(doc(window.FB.db, 'users', res.user.uid), {
        uid: res.user.uid,
        name: fullName || email.split('@')[0],
        full_name: fullName,
        email,
        phone,
        role,
        accessCodeUsed: accessCode || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      show('Account created successfully. Redirecting...');

      setTimeout(() => {
        location.href = `/${role}/dashboard.html`;
      }, 1200);
    } catch (err) {
      show(err.message || 'Registration failed', true);
      console.error('Registration error:', err);
    }
  });
}

if (forgotForm) {
  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();

    const email = forgotForm.email.value.trim();

    if (!email) {
      return show('Please enter your email address', true);
    }

    try {
      await sendPasswordResetEmail(auth, email);
      show('Password reset email sent! Please check your inbox (and spam/junk folder).');
    } catch (err) {
      show(err.message || 'Failed to send password reset email', true);
      console.error('Password reset error:', err);
    }
  });
}