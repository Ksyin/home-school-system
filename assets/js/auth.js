import './app.js';
const { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setDoc, doc, serverTimestamp, routeProfile, updateProfile } = window.AppUtil;
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotForm = document.getElementById('forgotForm');
const notice = document.getElementById('notice');
const show = (msg, err = false) => {
  if (notice) {
    notice.textContent = msg;
    notice.style.color = err ? '#b91c1c' : '#1d4ed8';
  }
};

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await signInWithEmailAndPassword(auth, loginForm.email.value.trim(), loginForm.password.value.trim());
      await routeProfile(res.user);
    } catch (err) {
      show(err.message, true);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = registerForm.fullName.value.trim();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value.trim();
    const role = registerForm.role.value;
    const phone = registerForm.phone.value.trim();
    const level = registerForm.level ? registerForm.level.value.trim() : '';

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(res.user, { displayName: fullName });

      const profile = {
        uid: res.user.uid,
        name: fullName,
        email,
        phone,
        role,
        level: level || '',
        createdAt: serverTimestamp(),
        status: 'active'
      };

      await setDoc(doc(window.FB.db, 'users', res.user.uid), profile);

      if (role === 'student') {
        await setDoc(doc(window.FB.db, 'students', res.user.uid), {
          uid: res.user.uid,
          userUid: res.user.uid,
          name: fullName,
          email,
          phone,
          level: level || '',
          status: 'active',
          tutorUid: '',
          parentUid: '',
          classroomIds: [],
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      show('Account created successfully. Redirecting...');
      await routeProfile(res.user);
    } catch (err) {
      show(err.message, true);
    }
  });
}

if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, forgotForm.email.value.trim());
      show('Password reset email sent. Check your inbox.');
    } catch (err) {
      show(err.message, true);
    }
  });
}
