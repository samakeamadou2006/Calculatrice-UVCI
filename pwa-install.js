let invitationInstallation = null;

const boutonInstallation = document.getElementById("btn-install-app");

function masquerBoutonInstallation() {
  if (boutonInstallation) boutonInstallation.hidden = true;
}

function afficherBoutonInstallation() {
  if (boutonInstallation) boutonInstallation.hidden = false;
}

// Enregistre le service worker uniquement sur les navigateurs compatibles.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch((erreur) => {
        console.warn("Service worker non enregistre.", erreur);
      });
  });
}

// Chrome/Android declenche cet evenement quand l'installation PWA est possible.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  invitationInstallation = event;
  afficherBoutonInstallation();
});

if (boutonInstallation) {
  boutonInstallation.addEventListener("click", async () => {
    if (!invitationInstallation) return;

    boutonInstallation.disabled = true;
    invitationInstallation.prompt();

    const choix = await invitationInstallation.userChoice;
    invitationInstallation = null;
    masquerBoutonInstallation();
    boutonInstallation.disabled = false;

    if (choix.outcome !== "accepted") {
      console.info("Installation PWA refusee par l'utilisateur.");
    }
  });
}

// Si l'application est installee, le bouton n'a plus de raison d'apparaitre.
window.addEventListener("appinstalled", () => {
  invitationInstallation = null;
  masquerBoutonInstallation();
});

// Evite d'afficher le bouton dans le mode application deja installe.
if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
  masquerBoutonInstallation();
}
