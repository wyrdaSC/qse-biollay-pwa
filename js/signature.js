// Pad de signature tactile (canvas), porté en module ES depuis
// application-qse/app/static/js/signature.js (voir §2 et Phase 5 du plan).

// Crée un pad de signature sur le canvas donné.
// Renvoie { estVide, versDataUrl, effacer }.
export function creerPadSignature(canvas) {
  const ctx = canvas.getContext("2d");
  let dessine = false;
  let vide = true;

  function position(evenement) {
    const rect = canvas.getBoundingClientRect();
    const source = evenement.touches ? evenement.touches[0] : evenement;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }

  function debut(evenement) {
    evenement.preventDefault();
    dessine = true;
    vide = false;
    const p = position(evenement);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function trace(evenement) {
    if (!dessine) return;
    evenement.preventDefault();
    const p = position(evenement);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function fin() {
    dessine = false;
  }

  canvas.addEventListener("mousedown", debut);
  canvas.addEventListener("mousemove", trace);
  window.addEventListener("mouseup", fin);
  canvas.addEventListener("touchstart", debut, { passive: false });
  canvas.addEventListener("touchmove", trace, { passive: false });
  canvas.addEventListener("touchend", fin);

  function chargerImage(dataUrl) {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
    vide = false;
  }

  function effacer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    vide = true;
  }

  // Ajuste la résolution interne du canvas à sa taille affichée.
  function redimensionner() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const sauvegarde = vide ? null : canvas.toDataURL();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c2530";
    if (sauvegarde) chargerImage(sauvegarde);
  }

  redimensionner();
  if (canvas.dataset.initial) chargerImage(canvas.dataset.initial);

  return {
    estVide: () => vide,
    versDataUrl: () => (vide ? "" : canvas.toDataURL("image/png")),
    effacer,
  };
}

// Initialise tous les pads `[data-pad]` présents dans le conteneur donné et
// branche les boutons d'effacement `[data-effacer-pad]`.
// Renvoie un dict { cle: pad } pour récupérer les signatures à l'enregistrement.
export function initialiserPads(conteneur = document) {
  const pads = {};

  conteneur.querySelectorAll("[data-pad]").forEach((canvas) => {
    pads[canvas.dataset.pad] = creerPadSignature(canvas);
  });

  conteneur.querySelectorAll("[data-effacer-pad]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const pad = pads[bouton.dataset.effacerPad];
      if (pad) pad.effacer();
    });
  });

  return pads;
}
