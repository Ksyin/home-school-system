// assets/js/page-app.js

const AuthAPI = window.AuthAPI;
const PageController = window.PageController;
const Utils = window.AppUtils || {};

if (!AuthAPI) {
  console.error("AuthAPI not loaded. Ensure auth.js loads before page-app.js");
}

async function waitForAuthReady() {

  return new Promise((resolve) => {

    const auth = window.FirebaseAuth;

    if (!auth) {
      resolve(null);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });

  });

}


async function bootstrapApplication() {

  try {

    // wait for firebase auth to load
    const user = await waitForAuthReady();

    // ensure profile exists
    if (user && AuthAPI && AuthAPI.ensureProfileForCurrentUser) {
      await AuthAPI.ensureProfileForCurrentUser();
    }

    // run page controller
    if (PageController && typeof PageController.init === "function") {

      await PageController.init();

    } else {

      console.warn("PageController not found.");

    }

  } catch (err) {

    console.error("Application bootstrap error:", err);

    if (Utils.showMessage) {
      Utils.showMessage("Application failed to start: " + err.message, "danger");
    }

  }

}


// run application
bootstrapApplication();