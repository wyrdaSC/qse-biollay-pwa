// Petites fonctions utilitaires partagées entre les vues.

// Échappe le HTML pour insertion sûre dans innerHTML.
export function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}
