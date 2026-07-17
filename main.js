// ==================================================================
// == CONFIGURATION POUR L'AUTHENTIFICATION PKCE                   ==
// ==================================================================
const CLIENT_ID = "4edb560c-d3f9-4d90-b7ee-6781976b0f50"; // <-- REMPLACEZ PAR VOTRE CLIENT ID
const REDIRECT_URI =
  "https://github.com/dorianlorenzato-max/Trimble-connect-ECNA-TEST/index.html"; // <-- REMPLACEZ PAR L'URL DE VOTRE EXTENSION (la page index.html)
// On importe uniquement les fonctions d'UI dont nous avons besoin
import { renderHomePage, renderLinkModal, renderLoginPrompt } from "./ui.js";
import {
  fetchUserProjectRole,
  fetchLinksConfiguration,
  getProjectRootId,
  findOrCreateFolder,
  saveLinksConfiguration,
} from "./api.js";

// Exécution dans une fonction auto-appelée pour un environnement propre
(async function () {
  // ==================================================================
  // == FONCTIONS UTILITAIRES POUR L'AUTHENTIFICATION PKCE   ==
  // ==================================================================

  // Fonction pour générer une chaîne aléatoire (le "code_verifier")
  function generateRandomString(length) {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let text = "";
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  // Fonction pour "hacher" le verifier et créer le "code_challenge"
  async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  // Fonction pour rediriger l'utilisateur vers la page de login Trimble
  async function initiateLogin() {
    const codeVerifier = generateRandomString(128);
    sessionStorage.setItem("pkce_code_verifier", codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const authUrl = new URL("https://identity.trimble.com/authorize");
    authUrl.searchParams.append("client_id", CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", "openid TrimbleConnect"); // Scopes de base
    authUrl.searchParams.append("code_challenge", codeChallenge);
    authUrl.searchParams.append("code_challenge_method", "S256");

    // L'API Workspace gère la redirection de la page principale de manière sécurisée.
    await triconnectAPI.host.openUrl(authUrl.toString(), "_top");
  }

  // Fonction pour échanger le code d'autorisation contre un access token
  async function getToken(authCode, codeVerifier) {
    const tokenUrl = "https://identity.trimble.com/token";
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code: authCode,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });
    if (!response.ok)
      throw new Error("Échec de l'échange du code contre un token.");
    return await response.json();
  }

  //Debut du code pour l'extension
  const mainContentDiv = document.getElementById("mainContent");
  const configBtn = document.getElementById("config-btn");
  let triconnectAPI;
  let globalAccessToken = null;
  let currentProjectId, configFolderId;

  let appState = {
    isConfigModeActive: false,
    editMode: "view",
    links: [],
  };

  // --- FONCTIONS DE Rendu et de Gestion des Événements ---

  // La fonction `rerenderUI` se contente d'appeler les deux autres.
  function rerenderUI() {
    renderHomePage(mainContentDiv, appState.links, appState);
    attachEventListeners(); // On attache les écouteurs APRÈS avoir dessiné l'interface.
  }

  //  On revient à une fonction qui attache les écouteurs aux éléments existants.
  function attachEventListeners() {
    console.log("Appel de attachEventListeners...");
    // 1. Gérer les boutons de configuration
    if (appState.isConfigModeActive) {
      document
        .getElementById("add-link-btn")
        .addEventListener("click", handleAddLink);
      document.getElementById("edit-link-btn").addEventListener("click", () => {
        appState.editMode = appState.editMode === "edit" ? "view" : "edit";
        rerenderUI();
      });
      document
        .getElementById("delete-link-btn")
        .addEventListener("click", () => {
          appState.editMode =
            appState.editMode === "delete" ? "view" : "delete";
          rerenderUI();
        });
    }

    // 2. Gérer le bouton "Terminer"
    const finishBtn = document.getElementById("finish-editing-btn");
    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        appState.editMode = "view";
        rerenderUI();
      });
    }

    // 3. Gérer les clics sur chaque "bouton lien" individuellement
    const linkButtons = document.querySelectorAll(".link-button");
    console.log(`${linkButtons.length} "boutons liens" trouvés.`);
    linkButtons.forEach((button) => {
      button.addEventListener("click", () => {
        console.log("--- Clic sur un bouton lien détecté ---");
        console.log("Mode d'édition actuel :", appState.editMode);

        const index = parseInt(button.dataset.index, 10);
        console.log("Index du bouton :", index);

        const link = appState.links[index];
        console.log("Lien correspondant dans l'état :", link);

        if (!link) {
          console.error(
            "ERREUR : Impossible de trouver le lien correspondant à cet index. L'état de l'application est peut-être désynchronisé.",
          );
          return;
        }

        // Pour cette étape, on ne gère que le mode 'view'.
        if (appState.editMode === "view") {
          console.log(
            "Mode 'view' actif. Tentative d'ouverture de l'URL :",
            link.url,
          );
          window.open(link.url, "_blank");
        } else if (appState.editMode === "delete") {
          //  Log pour tracer l'appel
          console.log(
            `Mode 'delete' détecté. Appel de handleDeleteLink pour l'index ${index}...`,
          );
          handleDeleteLink(index);
        } else if (appState.editMode === "edit") {
          console.log(
            `Mode 'edit' détecté. Appel de handleEditLink pour l'index ${index}...`,
          );
          handleEditLink(index);
        } else {
          console.log(
            `Clic ignoré car le mode est '${appState.editMode}', pas 'view'.`,
          );
        }
      });
    });
  }

  // --- LOGIQUE MÉTIER (Ajouter, Modifier, Supprimer) ---

  async function saveAndRerender() {
    try {
      await saveLinksConfiguration(
        globalAccessToken,
        configFolderId,
        appState.links,
      );
    } catch (error) {
      console.error("Échec de la sauvegarde :", error);
      alert("Erreur : Impossible de sauvegarder la configuration.");
      return loadInitialDataAndRender(); // En cas d'erreur, on recharge tout.
    }
    rerenderUI();
  }

  function handleAddLink() {
    const onAddConfirm = async (name, url) => {
      appState.links.push({ name, url });
      await saveAndRerender();
    };
    renderLinkModal(onAddConfirm);
  }

  function handleEditLink(index) {
    const linkToEdit = appState.links[index];
    const onEditConfirm = async (newName, newUrl) => {
      appState.links[index] = { name: newName, url: newUrl };
      appState.editMode = "view";
      await saveAndRerender();
    };
    renderLinkModal(onEditConfirm, linkToEdit);
  }

  async function handleDeleteLink(index) {
    const linkToDelete = appState.links[index];
    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer le lien "${linkToDelete.name}" ?`,
      )
    ) {
      appState.links.splice(index, 1);
      appState.editMode = "view";
      await saveAndRerender();
    }
  }

  // ==================================================================
  // ==  SÉQUENCE D'INITIALISATION AVEC PKCE                ==
  // ==================================================================
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");

    triconnectAPI = await TrimbleConnectWorkspace.connect(
      window.parent,
      () => {},
      30000,
    );

    // CAS B : L'utilisateur revient de la page de login Trimble avec un code
    if (authCode) {
      const codeVerifier = sessionStorage.getItem("pkce_code_verifier");
      if (!codeVerifier)
        throw new Error(
          "Code Verifier introuvable dans la session. Le flux d'authentification a échoué.",
        );

      const tokenData = await getToken(authCode, codeVerifier);
      globalAccessToken = tokenData.access_token; // On récupère le token !

      // On nettoie l'URL pour enlever le code, pour éviter les re-traitements
      window.history.replaceState({}, document.title, window.location.pathname);

      console.log(
        "Authentification PKCE réussie, lancement de l'application...",
      );
      await launchApplication(); // On lance la logique principale de l'app
    }
    // CAS A : L'utilisateur charge l'extension pour la première fois
    else {
      console.log(
        "Aucun code d'authentification trouvé. Affichage du bouton de connexion.",
      );

      // 1. Affiche l'interface avec le bouton
      renderLoginPrompt(mainContentDiv);

      // 2. Attache un écouteur d'événement au clic sur le bouton
      document
        .getElementById("login-btn")
        .addEventListener("click", async () => {
          mainContentDiv.innerHTML = "<p>Redirection en cours...</p>";
          await initiateLogin(); // Déclenche la redirection APRÈS le clic
        });
    }
  } catch (error) {
    console.error(
      "Erreur critique au démarrage ou durant l'authentification :",
      error,
    );
    mainContentDiv.innerHTML = `<p style="color:red;">Erreur critique : ${error.message}</p>`;
  }

  // Cette fonction encapsule la logique de votre application une fois le token obtenu.
  async function launchApplication() {
    if (!globalAccessToken) {
      throw new Error(
        "Tentative de lancement de l'application sans Access Token.",
      );
    }

    // --- On remet ici votre logique originale de chargement de données ---
    console.log("--- Access Token Utilisateur ---");
    console.log(globalAccessToken);
    console.log("---------------------------------");

    triconnectAPI.ui.setMenu({
      title: "TEST",
      icon: "https://dorianlorenzato-max.github.io/trimble-connect-ecna-extension/logoEiffage.png",
      command: "test_extension_clicked",
    });

    const project = await triconnectAPI.project.getCurrentProject();
    if (!project || !project.id)
      throw new Error(
        "Impossible de récupérer les informations du projet actuel.",
      );

    currentProjectId = project.id;
    console.log(`Projet actuel ID : ${currentProjectId}`);

    configBtn.addEventListener("click", () => {
      appState.isConfigModeActive = !appState.isConfigModeActive;
      if (!appState.isConfigModeActive) appState.editMode = "view";
      rerenderUI();
    });

    async function loadInitialDataAndRender() {
      try {
        mainContentDiv.innerHTML = "<p>Chargement des données du projet...</p>";
        const userRole = await fetchUserProjectRole(
          currentProjectId,
          globalAccessToken,
        );
        if (userRole === "ADMIN") configBtn.style.display = "block";

        const projectRootId = await getProjectRootId(
          triconnectAPI,
          globalAccessToken,
        );
        configFolderId = await findOrCreateFolder(
          projectRootId,
          "Configuration_Links",
          globalAccessToken,
        );
        appState.links = await fetchLinksConfiguration(
          globalAccessToken,
          configFolderId,
        );

        rerenderUI();
      } catch (error) {
        console.error("Erreur lors du chargement des données :", error);
        mainContentDiv.innerHTML = `<p style="color:red;">Erreur lors du chargement des données : ${error.message}</p>`;
      }
    }

    await loadInitialDataAndRender();
  }
})(); // Fin de l'IIFE
