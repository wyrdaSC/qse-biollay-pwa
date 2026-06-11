// Écran de consultation d'une fiche : résumé, badge de conformité/statut,
// téléchargement du PDF, envoi par email (mailto), marquage "envoyée",
// modification et suppression (§8, Phase 6).

import { libelleType } from "../forms-def.js";
import { getFiche, definirStatut, supprimerFiche } from "../db.js";
import { genererPdf, nomFichier } from "../pdf.js";
import { echapperHtml, telechargerBlob } from "../util.js";

const STATUT_LABELS = {
  brouillon: "Brouillon",
  complet: "Complet",
  envoye: "Envoyée",
};

export async function rendreConsultation(id) {
  const ecran = document.getElementById("ecran");
  ecran.innerHTML = `<h1 class="page-title">Fiche</h1><p class="vide">Chargement…</p>`;

  const fiche = await getFiche(id);
  if (!fiche) {
    ecran.innerHTML = `
      <h1 class="page-title">Fiche introuvable</h1>
      <p class="vide">Cette fiche n'existe pas ou a été supprimée.</p>
    `;
    return;
  }

  let badgeConformite = "";
  if (fiche.conforme !== null && fiche.conforme !== undefined) {
    badgeConformite = `
      <p class="badge-conformite ${fiche.conforme ? "conforme" : "non-conforme"}">
        ${fiche.conforme ? "CONFORME" : "NON CONFORME"}
      </p>
    `;
  }

  ecran.innerHTML = `
    <h1 class="page-title">${echapperHtml(libelleType(fiche.type))}</h1>

    <div class="bloc-resultats">
      <p><strong>N° de fiche :</strong> ${echapperHtml(fiche.numero || "—")}</p>
      <p><strong>Chantier :</strong> ${echapperHtml(fiche.chantier || "—")}</p>
      <p><strong>Localisation :</strong> ${echapperHtml(fiche.localisation || "—")}</p>
      <p><strong>Date :</strong> ${echapperHtml(fiche.date || "—")}</p>
      <p><strong>Contrôleur :</strong> ${echapperHtml(fiche.controleur || "—")}</p>
      <p><strong>Statut :</strong> <span class="badge badge--${fiche.statut}">${STATUT_LABELS[fiche.statut] || fiche.statut}</span></p>
      ${badgeConformite}
    </div>

    <div class="boutons-action">
      <button type="button" class="btn btn-principal" id="btn-telecharger">Télécharger le PDF</button>
      <a class="btn btn-secondaire" href="#/fiche/${fiche.id}/modifier">Modifier</a>
    </div>

    <section>
      <h2 class="page-subtitle">Envoyer par email</h2>
      <p class="legende">Téléchargez d'abord le PDF, puis joignez-le manuellement au courriel.</p>
      ${!navigator.onLine ? `<p class="legende">Fonction email indisponible hors connexion.</p>` : ""}
      <div class="champ">
        <label for="champ-email-destinataire">Email du destinataire (optionnel)</label>
        <input type="email" id="champ-email-destinataire" placeholder="prenom.nom@biollaysa.ch">
      </div>
      <div class="boutons-action">
        <a class="btn btn-secondaire ${!navigator.onLine ? "btn--desactive" : ""}" id="btn-email" href="#"${!navigator.onLine ? ' aria-disabled="true"' : ""}>Envoyer par email</a>
        ${fiche.statut !== "envoye" ? `<button type="button" class="btn btn-secondaire" id="btn-marquer-envoyee">Marquer comme envoyée</button>` : ""}
      </div>
    </section>

    <div class="boutons-action">
      <button type="button" class="btn btn-texte" id="btn-supprimer">Supprimer la fiche</button>
    </div>
  `;

  brancherEvenements(fiche);
}

function brancherEvenements(fiche) {
  document.getElementById("btn-telecharger").addEventListener("click", async (evenement) => {
    const bouton = evenement.target;
    bouton.disabled = true;
    try {
      const blob = await genererPdf(fiche);
      telechargerBlob(blob, nomFichier(fiche));
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById("btn-email").addEventListener("click", (evenement) => {
    evenement.preventDefault();
    if (!navigator.onLine) return;
    const destinataire = document.getElementById("champ-email-destinataire").value.trim();
    const sujet = `[QSE] ${libelleType(fiche.type)} - ${fiche.chantier || ""} - ${fiche.date || ""}`;
    const corps = [
      "Bonjour,",
      "",
      `Veuillez trouver ci-joint la fiche de contrôle « ${libelleType(fiche.type)} » pour le chantier ${fiche.chantier || "—"} en date du ${fiche.date || "—"}.`,
      "",
      "IMPORTANT : pensez à joindre le fichier PDF préalablement téléchargé depuis l'application.",
      "",
      "Cordialement",
    ].join("\n");
    window.location.href =
      `mailto:${encodeURIComponent(destinataire)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;

    if (fiche.statut !== "envoye") {
      window.addEventListener(
        "focus",
        () => {
          if (confirm("Marquer cette fiche comme « Envoyée » ?")) {
            definirStatut(fiche.id, "envoye").then(() => rendreConsultation(fiche.id));
          }
        },
        { once: true }
      );
    }
  });

  const btnMarquer = document.getElementById("btn-marquer-envoyee");
  if (btnMarquer) {
    btnMarquer.addEventListener("click", async () => {
      await definirStatut(fiche.id, "envoye");
      rendreConsultation(fiche.id);
    });
  }

  document.getElementById("btn-supprimer").addEventListener("click", async () => {
    if (!confirm("Supprimer définitivement cette fiche ?")) return;
    await supprimerFiche(fiche.id);
    window.location.hash = "#/";
  });
}
