// Petites fonctions utilitaires partagées entre les vues.

// Échappe le HTML pour insertion sûre dans innerHTML.
export function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

// Déclenche le téléchargement d'un Blob sous le nom de fichier donné.
export function telechargerBlob(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
