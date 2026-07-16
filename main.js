// On importe uniquement les fonctions d'UI dont nous avons besoin
import { renderLoading, renderError, renderHomePage } from "./ui.js";

// Exécution dans une fonction auto-appelée pour un environnement propre
(async function () {
  const mainContentDiv = document.getElementById("mainContent");
  let triconnectAPI;
  let globalAccessToken = null;

  // ==================================================================
  // == SÉQUENCE D'INITIALISATION SIMPLIFIÉE                         ==
  // ==================================================================
  try {
    // 1. Afficher le chargement
    renderLoading(mainContentDiv);

    // 2. Se connecter à l'API de l'espace de travail Trimble Connect
    triconnectAPI = await TrimbleConnectWorkspace.connect(
      window.parent,
      () => {},
      30000,
    );

    // 3. Demander la permission pour l'access token
    globalAccessToken =
      await triconnectAPI.extension.requestPermission("accesstoken");
    if (!globalAccessToken) {
      throw new Error(
        "L'Access Token est invalide ou n'a pas pu être récupéré.",
      );
    }

    // 4. AFFICHER L'ACCESS TOKEN DANS LA CONSOLE (Objectif principal)
    console.log("--- Access Token Utilisateur ---");
    console.log(globalAccessToken);
    console.log("---------------------------------");

    // 5. Mettre à jour le menu de l'extension pour correspondre au nouveau nom
    triconnectAPI.ui.setMenu({
      title: "test",
      icon: "https://dorianlorenzato-max.github.io/trimble-connect-ecna-extension/logoEiffage.png",
      command: "test_extension_clicked",
    });

    // 6. Afficher la page d'accueil finale
    renderHomePage(mainContentDiv);
  } catch (error) {
    console.error(
      "Erreur critique lors de l'initialisation de l'extension de test :",
      error,
    );
    renderError(mainContentDiv, error);
  }
})();
