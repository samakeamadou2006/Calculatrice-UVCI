// ============================================================
// STRUCTURE FIXE DE L'UVCI
// ============================================================
const STRUCTURE = [
  {
    id: "s1",
    nom: "Semestre 1",
    vagues: [
      { id: "s1v1", nom: "Vague 1" },
      { id: "s1v2", nom: "Vague 2" },
      { id: "s1v3", nom: "Vague 3" }
    ]
  },
  {
    id: "s2",
    nom: "Semestre 2",
    vagues: [
      { id: "s2v1", nom: "Vague 1" },
      { id: "s2v2", nom: "Vague 2" },
      { id: "s2v3", nom: "Vague 3" }
    ]
  }
];

const SEUIL_ADMISSION = 10;
const NOMBRE_DEVOIRS = 6;
const CLE_STOCKAGE = "uvci-donnees";

let donnees = {};
const sectionsReduites = {};

function nouveauCours() {
  return {
    id: Math.random().toString(36).slice(2, 10),
    nom: "",
    coefficient: 1,
    devoirs: Array(NOMBRE_DEVOIRS).fill(""),
    examen: ""
  };
}

function echapperAttribut(valeur) {
  return String(valeur ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function idValide(id) {
  return typeof id === "string" && /^[a-z0-9_-]{4,32}$/i.test(id);
}

function libelleCours(cours) {
  const nom = String(cours.nom ?? "").trim();
  return nom || "Cours sans nom";
}

function lireNombre(valeur) {
  const texte = String(valeur ?? "").trim().replace(",", ".");
  if (texte === "") return null;

  const nombre = Number(texte);
  return Number.isFinite(nombre) ? nombre : null;
}

function noteValide(valeur) {
  const note = lireNombre(valeur);
  return note !== null && note >= 0 && note <= 20;
}

function coefficientValide(valeur) {
  const coefficient = lireNombre(valeur);
  return coefficient !== null && coefficient >= 1 && coefficient <= 10;
}

function coefficientCours(cours) {
  return coefficientValide(cours?.coefficient) ? lireNombre(cours.coefficient) : 1;
}

function moyenneTexte(moyenne) {
  return moyenne !== null ? `${moyenne}/20` : "--";
}

function sectionEstReduite(idSection) {
  return sectionsReduites[idSection] === true;
}

function boutonReduction(idSection) {
  const reduit = sectionEstReduite(idSection);
  return `
    <button class="btn-reduire" type="button" data-action="toggle-section" data-section="${idSection}"
      aria-expanded="${!reduit}" title="${reduit ? "Agrandir" : "Réduire"}">
      <span aria-hidden="true">${reduit ? "+" : "−"}</span>
    </button>
  `;
}

function statutTexte(statut) {
  if (statut === "admis") return "✅ Admis";
  if (statut === "session") return "🔴 Session";
  return "--";
}

// ============================================================
// DONNÉES
// ============================================================
function initialiserDonnees() {
  STRUCTURE.forEach(semestre => {
    semestre.vagues.forEach(vague => {
      if (!Array.isArray(donnees[vague.id])) {
        donnees[vague.id] = [nouveauCours()];
      }

      donnees[vague.id] = donnees[vague.id].map(cours => {
        const base = nouveauCours();

        return {
          ...base,
          ...cours,
          id: idValide(cours?.id) ? cours.id : base.id,
          devoirs: Array.isArray(cours?.devoirs)
            ? [...cours.devoirs, ...Array(NOMBRE_DEVOIRS).fill("")].slice(0, NOMBRE_DEVOIRS)
            : Array(NOMBRE_DEVOIRS).fill(""),
          coefficient: coefficientValide(cours?.coefficient) ? cours.coefficient : 1
        };
      });

      if (donnees[vague.id].length === 0) {
        donnees[vague.id] = [nouveauCours()];
      }
    });
  });
}

function sauvegarder() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
  } catch (erreur) {
    console.warn("Impossible d'enregistrer les données localement.", erreur);
  }
}

function charger() {
  const sauvegarde = localStorage.getItem(CLE_STOCKAGE);

  if (sauvegarde) {
    try {
      donnees = JSON.parse(sauvegarde);
      if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) {
        donnees = {};
      }
    } catch (erreur) {
      console.warn("Sauvegarde locale illisible, réinitialisation des données.", erreur);
      localStorage.removeItem(CLE_STOCKAGE);
      donnees = {};
    }
  }

  initialiserDonnees();
}

// ============================================================
// CALCULS
// ============================================================
function calculerMoyenneCours(cours) {
  const devoirsSaisis = cours.devoirs.filter(d => String(d ?? "").trim() !== "");

  if (devoirsSaisis.length === 0 || devoirsSaisis.some(d => !noteValide(d))) {
    return null;
  }

  if (!noteValide(cours.examen)) return null;

  const devoirsValides = devoirsSaisis.map(d => lireNombre(d));
  const examen = lireNombre(cours.examen);
  const somme = devoirsValides.reduce((total, note) => total + note, 0);
  const moyenneDevoirs = somme / devoirsValides.length;
  const moyenneCours = (moyenneDevoirs * 0.4) + (examen * 0.6);

  return Math.round(moyenneCours * 100) / 100;
}

function determinerStatut(moyenne) {
  if (moyenne === null) return "vide";
  if (moyenne >= SEUIL_ADMISSION) return "admis";
  return "session";
}

function statsVague(vagueId) {
  const cours = donnees[vagueId] || [];
  let admis = 0;
  let session = 0;

  cours.forEach(c => {
    const moyenne = calculerMoyenneCours(c);
    if (moyenne === null) return;
    if (moyenne >= SEUIL_ADMISSION) admis++;
    else session++;
  });

  return { admis, session };
}

function statsSemestre(semestre) {
  let admis = 0;
  let session = 0;

  semestre.vagues.forEach(vague => {
    const stats = statsVague(vague.id);
    admis += stats.admis;
    session += stats.session;
  });

  return { admis, session };
}

function statsGlobales() {
  let admis = 0;
  let session = 0;
  let total = 0;
  let sommePonderee = 0;
  let sommeCoefficients = 0;

  STRUCTURE.forEach(semestre => {
    semestre.vagues.forEach(vague => {
      const cours = donnees[vague.id] || [];
      cours.forEach(c => {
        const moyenne = calculerMoyenneCours(c);
        if (moyenne === null) return;

        const coefficient = coefficientCours(c);
        total++;
        sommePonderee += moyenne * coefficient;
        sommeCoefficients += coefficient;

        if (moyenne >= SEUIL_ADMISSION) admis++;
        else session++;
      });
    });
  });

  const moyenneGenerale = sommeCoefficients > 0
    ? Math.round((sommePonderee / sommeCoefficients) * 100) / 100
    : null;

  return { admis, session, total, moyenneGenerale };
}

function coursEnSession() {
  const liste = [];

  STRUCTURE.forEach(semestre => {
    semestre.vagues.forEach(vague => {
      const cours = donnees[vague.id] || [];
      cours.forEach(c => {
        const moyenne = calculerMoyenneCours(c);
        if (moyenne !== null && moyenne < SEUIL_ADMISSION) {
          liste.push({
            cours: c,
            moyenne,
            semestre: semestre.nom,
            vague: vague.nom
          });
        }
      });
    });
  });

  return liste;
}

// ============================================================
// AFFICHAGE
// ============================================================
function afficher() {
  const container = document.getElementById("semestres");
  container.innerHTML = "";

  STRUCTURE.forEach(semestre => {
    const stats = statsSemestre(semestre);
    const blocSemestre = document.createElement("div");
    const reduit = sectionEstReduite(semestre.id);

    blocSemestre.className = `semestre-bloc ${reduit ? "est-reduit" : ""}`;
    blocSemestre.innerHTML = `
      <div class="semestre-entete">
        <div class="semestre-identite">
          ${boutonReduction(semestre.id)}
          <span class="semestre-titre">${semestre.nom}</span>
        </div>
        <div class="semestre-stats" id="stats-${semestre.id}">
          <span class="stat-pill">✅ ${stats.admis} admis</span>
          <span class="stat-pill">🔴 ${stats.session} session</span>
        </div>
      </div>
      <div class="vagues-liste contenu-reductible" id="vagues-${semestre.id}" ${reduit ? "hidden" : ""}></div>
    `;

    container.appendChild(blocSemestre);

    const vaguesContainer = document.getElementById(`vagues-${semestre.id}`);
    semestre.vagues.forEach(vague => {
      vaguesContainer.appendChild(afficherVague(vague));
    });
  });

  afficherSectionSession(container);
  mettreAJourResume();
}

function afficherSectionSession(container) {
  const blocSession = document.createElement("div");
  const reduit = sectionEstReduite("session");
  blocSession.className = `semestre-bloc session-bloc ${reduit ? "est-reduit" : ""}`;
  blocSession.id = "section-session";

  blocSession.innerHTML = `
    <div class="semestre-entete session-entete">
      <div class="semestre-identite">
        ${boutonReduction("session")}
        <span class="semestre-titre">Session</span>
      </div>
      <div class="semestre-stats">
        <span class="stat-pill" id="session-total">0 cours</span>
      </div>
    </div>
    <div class="session-corps contenu-reductible" id="session-corps" ${reduit ? "hidden" : ""}></div>
  `;

  container.appendChild(blocSession);
  mettreAJourSession();
}

function mettreAJourSession() {
  const corps = document.getElementById("session-corps");
  const total = document.getElementById("session-total");
  if (!corps || !total) return;

  const liste = coursEnSession();
  total.textContent = `${liste.length} cours`;

  if (liste.length === 0) {
    corps.innerHTML = `<p class="session-vide">Aucun cours en session pour le moment.</p>`;
    return;
  }

  const lignes = liste.map(item => `
    <tr>
      <td>${echapperAttribut(libelleCours(item.cours))}</td>
      <td>${echapperAttribut(item.semestre)}</td>
      <td>${echapperAttribut(item.vague)}</td>
      <td style="text-align:center">
        <span class="badge-moy session">${item.moyenne}/20</span>
      </td>
      <td style="text-align:center">
        <span class="badge-statut session">🔴 Session</span>
      </td>
    </tr>
  `).join("");

  corps.innerHTML = `
    <div class="session-table-wrap">
      <table class="cours-tableau session-tableau">
        <thead>
          <tr>
            <th>Cours</th>
            <th>Semestre</th>
            <th>Vague</th>
            <th style="width:14%">Moyenne</th>
            <th style="width:16%">Statut</th>
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
  `;
}

function afficherVague(vague) {
  const cours = donnees[vague.id] || [];
  const stats = statsVague(vague.id);
  const entetesDevoirs = Array.from({ length: NOMBRE_DEVOIRS }, (_, i) => `<th>Devoir ${i + 1}</th>`).join("");
  const bloc = document.createElement("div");

  bloc.className = "vague-bloc";
  bloc.dataset.vague = vague.id;
  bloc.innerHTML = `
    <div class="vague-entete">
      <span class="vague-titre">${vague.nom}</span>
      <div class="vague-stats" id="stats-${vague.id}">
        ${stats.admis > 0 ? `<span style="color:var(--succes)">✅ ${stats.admis} admis</span>` : ""}
        ${stats.session > 0 ? `<span style="color:var(--danger)">🔴 ${stats.session} session</span>` : ""}
      </div>
    </div>
    <div class="vague-corps">
      <table class="cours-tableau">
        <thead>
          <tr>
            <th style="width:20%">Cours</th>
            <th style="width:6%">Coef.</th>
            ${entetesDevoirs}
            <th style="width:9%">Examen</th>
            <th style="width:9%">Moyenne</th>
            <th style="width:13%">Statut</th>
            <th style="width:4%"></th>
          </tr>
        </thead>
        <tbody id="tbody-${vague.id}"></tbody>
      </table>
      <div class="vague-pied">
        <button class="btn-sm btn-ajouter" data-action="ajouter-cours" data-vague="${vague.id}">
          + Ajouter un cours
        </button>
        <span class="formule-info">Formule : (moy. devoirs × 40%) + (examen × 60%) · Admission ≥ 10/20 · Moyenne générale pondérée par coefficient</span>
      </div>
    </div>
  `;

  const tbody = bloc.querySelector(`#tbody-${vague.id}`);
  cours.forEach(c => {
    tbody.appendChild(afficherLigneCours(vague.id, c, cours.length));
  });

  return bloc;
}

function afficherLigneCours(vagueId, cours, nombreCoursVague) {
  const moyenne = calculerMoyenneCours(cours);
  const statut = determinerStatut(moyenne);
  const nomCours = echapperAttribut(cours.nom);
  const coefficient = echapperAttribut(coefficientCours(cours));
  const examen = echapperAttribut(cours.examen);
  const coursId = echapperAttribut(cours.id);
  const suppressionDesactivee = nombreCoursVague <= 1 ? "disabled" : "";
  const titreSuppression = nombreCoursVague <= 1
    ? "Chaque vague doit garder au moins un cours"
    : "Supprimer ce cours";
  const ligne = document.createElement("tr");

  ligne.className = "cours-ligne";
  ligne.dataset.id = cours.id;

  const cellsDevoirs = cours.devoirs.map((note, i) => `
    <td>
      <input class="inp inp-num" type="number" min="0" max="20" step="0.25"
        value="${echapperAttribut(note)}" placeholder="--"
        data-action="devoir"
        data-vague="${vagueId}"
        data-cours="${coursId}"
        data-index="${i}" />
    </td>
  `).join("");

  ligne.innerHTML = `
    <td>
      <input class="inp" type="text" value="${nomCours}" placeholder="Nom du cours"
        data-action="nom" data-vague="${vagueId}" data-cours="${coursId}" />
    </td>
    <td>
      <input class="inp inp-num" type="number" min="1" max="10" step="0.5" value="${coefficient}"
        data-action="coefficient" data-vague="${vagueId}" data-cours="${coursId}" />
    </td>
    ${cellsDevoirs}
    <td>
      <input class="inp inp-num" type="number" min="0" max="20" step="0.25"
        value="${examen}" placeholder="--"
        data-action="examen" data-vague="${vagueId}" data-cours="${coursId}" />
    </td>
    <td style="text-align:center">
      <span class="badge-moy ${statut}" data-moy="${coursId}">
        ${moyenneTexte(moyenne)}
      </span>
    </td>
    <td style="text-align:center">
      <span class="badge-statut ${statut}" data-statut="${coursId}">
        ${statutTexte(statut)}
      </span>
    </td>
    <td style="text-align:center">
      <button class="btn-sm btn-suppr" data-action="suppr-cours"
        data-vague="${vagueId}" data-cours="${coursId}" title="${titreSuppression}" ${suppressionDesactivee}>×</button>
    </td>
  `;

  return ligne;
}

function mettreAJourCours(vagueId, coursId) {
  const cours = donnees[vagueId]?.find(c => c.id === coursId);
  if (!cours) return;

  const moyenne = calculerMoyenneCours(cours);
  const statut = determinerStatut(moyenne);
  const elMoy = document.querySelector(`[data-moy="${coursId}"]`);
  const elStatut = document.querySelector(`[data-statut="${coursId}"]`);

  if (elMoy) {
    elMoy.textContent = moyenneTexte(moyenne);
    elMoy.className = `badge-moy ${statut}`;
  }

  if (elStatut) {
    elStatut.textContent = statutTexte(statut);
    elStatut.className = `badge-statut ${statut}`;
  }

  mettreAJourStatsVague(vagueId);
  mettreAJourStatsSemestre(vagueId);
  mettreAJourResume();
  mettreAJourSession();
}

function mettreAJourStatsVague(vagueId) {
  const el = document.getElementById(`stats-${vagueId}`);
  if (!el) return;

  const { admis, session } = statsVague(vagueId);
  el.innerHTML = `
    ${admis > 0 ? `<span style="color:var(--succes)">✅ ${admis} admis</span>` : ""}
    ${session > 0 ? `<span style="color:var(--danger)">🔴 ${session} session</span>` : ""}
  `;
}

function mettreAJourStatsSemestre(vagueId) {
  STRUCTURE.forEach(semestre => {
    const appartient = semestre.vagues.some(v => v.id === vagueId);
    if (!appartient) return;

    const el = document.getElementById(`stats-${semestre.id}`);
    if (!el) return;

    const { admis, session } = statsSemestre(semestre);
    el.innerHTML = `
      <span class="stat-pill">✅ ${admis} admis</span>
      <span class="stat-pill">🔴 ${session} session</span>
    `;
  });
}

function mettreAJourResume() {
  const { admis, session, total, moyenneGenerale } = statsGlobales();

  document.getElementById("total-admis").textContent = admis;
  document.getElementById("total-session").textContent = session;
  document.getElementById("total-cours").textContent = total;
  document.getElementById("moyenne-generale").textContent = moyenneTexte(moyenneGenerale);
}

// ============================================================
// ÉVÉNEMENTS
// ============================================================
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;

  const action = el.dataset.action;
  const vagueId = el.dataset.vague;
  const coursId = el.dataset.cours;

  if (action === "toggle-section") {
    const section = el.dataset.section;
    sectionsReduites[section] = !sectionEstReduite(section);
    afficher();
  }

  if (action === "ajouter-cours") {
    donnees[vagueId].push(nouveauCours());
    sauvegarder();
    afficher();
  }

  if (action === "suppr-cours") {
    if (donnees[vagueId].length <= 1) return;
    donnees[vagueId] = donnees[vagueId].filter(c => c.id !== coursId);
    sauvegarder();
    afficher();
  }
});

document.addEventListener("input", (e) => {
  const el = e.target;
  const action = el.dataset.action;
  if (!action) return;

  const vagueId = el.dataset.vague;
  const coursId = el.dataset.cours;
  const index = Number.parseInt(el.dataset.index, 10);
  const cours = donnees[vagueId]?.find(c => c.id === coursId);
  if (!cours) return;

  if (action === "nom") cours.nom = el.value;
  if (action === "coefficient") cours.coefficient = el.value;
  if (action === "examen") cours.examen = el.value;
  if (action === "devoir" && Number.isInteger(index)) cours.devoirs[index] = el.value;

  sauvegarder();
  mettreAJourCours(vagueId, coursId);
});

// ============================================================
// RÉINITIALISATION
// ============================================================
const modalReset = document.getElementById("modal-reset");
const boutonReset = document.getElementById("btn-reset");
const boutonResetAnnuler = document.getElementById("btn-reset-annuler");
const boutonResetConfirmer = document.getElementById("btn-reset-confirmer");
let elementAvantModal = null;

function elementsFocusModal() {
  return Array.from(modalReset.querySelectorAll("button"));
}

function ouvrirModalReset() {
  elementAvantModal = document.activeElement;
  modalReset.hidden = false;
  boutonResetAnnuler.focus();
}

function fermerModalReset() {
  modalReset.hidden = true;
  if (elementAvantModal) elementAvantModal.focus();
}

boutonReset.addEventListener("click", ouvrirModalReset);
boutonResetAnnuler.addEventListener("click", fermerModalReset);

boutonResetConfirmer.addEventListener("click", () => {
  localStorage.removeItem(CLE_STOCKAGE);
  donnees = {};
  initialiserDonnees();
  sauvegarder();
  afficher();
  fermerModalReset();
});

modalReset.addEventListener("click", (e) => {
  if (e.target === modalReset) fermerModalReset();
});

document.addEventListener("keydown", (e) => {
  if (modalReset.hidden) return;

  if (e.key === "Escape") {
    fermerModalReset();
    return;
  }

  if (e.key !== "Tab") return;

  const focusables = elementsFocusModal();
  const premier = focusables[0];
  const dernier = focusables[focusables.length - 1];

  if (e.shiftKey && document.activeElement === premier) {
    e.preventDefault();
    dernier.focus();
  } else if (!e.shiftKey && document.activeElement === dernier) {
    e.preventDefault();
    premier.focus();
  }
});

// ============================================================
// EXPORT PDF
// ============================================================
document.getElementById("btn-pdf").addEventListener("click", () => {
  window.print();
});

// ============================================================
// DÉMARRAGE
// ============================================================
charger();
afficher();
