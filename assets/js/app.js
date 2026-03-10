// assets/js/app.js

const auth = window.FirebaseAuth;

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


document.getElementById("loginForm")?.addEventListener("submit", async e => {

  e.preventDefault();

  const email = e.target.email.value;
  const password = e.target.password.value;

  await signInWithEmailAndPassword(auth, email, password);

  location.href = "/dashboard.html";

});


document.getElementById("registerForm")?.addEventListener("submit", async e => {

  e.preventDefault();

  const email = e.target.email.value;
  const password = e.target.password.value;

  await createUserWithEmailAndPassword(auth, email, password);

  location.href = "/dashboard.html";

});