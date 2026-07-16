/**
 * Module simplifié pour la manipulation du DOM.
 */

// Affiche l'état de chargement
function renderLoading(container) {
  container.innerHTML = `<h1>Chargement...</h1>`;
}

// Affiche un message d'erreur
function renderError(container, error) {
  container.innerHTML = `
        <h1>Erreur !</h1>
        <p>Une erreur est survenue. Veuillez vérifier la console pour les détails.</p>
        <p><b>Détail :</b> ${error.message || error}</p>
    `;
}

// Affiche la page d'accueil du test
function renderHomePage(container) {
  container.innerHTML = `
    <div style="text-align: center; padding: 20px;">
        <h1>Extension de Test</h1>
        <p>L'extension a démarré avec succès.</p>
        <p>L'<strong>access token</strong> de l'utilisateur a été récupéré et affiché dans la console de développement de votre navigateur (généralement accessible avec la touche F12).</p>
    </div>
  `;
}

// Exporter uniquement les fonctions nécessaires
export { renderLoading, renderError, renderHomePage };
