/**
 * Auth : Supabase Auth.
 * Base URL : meta signvue-api-base, window.__SIGNVUE_API_BASE__, ou défaut Render.
 */

function getApiBase() {
    const raw =
        (typeof window.__SIGNVUE_API_BASE__ === "string" && window.__SIGNVUE_API_BASE__.trim()) ||
        "";
    const base = (raw || "https://signvue-api.onrender.com").replace(/\/$/, "");
    return base;
}

function apiUrl(path) {
    const p = String(path || "").startsWith("/") ? path : `/${path}`;
    return `${getApiBase()}${p}`;
}

const video = document.getElementById("video");
const output = document.getElementById("output");
const placeholder = document.getElementById("video-placeholder");
const playFab = document.getElementById("play-fab");

const authModal = document.getElementById("auth-modal");
const authBackdrop = document.getElementById("auth-modal-backdrop");
const authClose = document.getElementById("auth-close");
const authIntro = document.getElementById("auth-intro");
const authError = document.getElementById("auth-error");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const headerBtnAuth = document.getElementById("header-btn-auth");
const headerUserBar = document.getElementById("header-user-bar");
const userMenu = document.getElementById("user-menu");
const userAccountBtn = document.getElementById("user-account-btn");
const userAccountPanel = document.getElementById("user-account-panel");
const userPanelEmail = document.getElementById("user-panel-email");
const btnLogout = document.getElementById("btn-logout");
const demoLeadDefault = document.getElementById("demo-lead-default");
const demoLeadLogged = document.getElementById("demo-lead-logged");
const featureDetailEl = document.getElementById("feature-detail");
const featureDetailImg = document.getElementById("feature-detail-img");
const featureDetailTitle = document.getElementById("feature-detail-title");
const featureDetailBody = document.getElementById("feature-detail-body");
const featureDetailClose = document.getElementById("feature-detail-close");

let simInterval = null;
let openFeatureId = null;

const FEATURE_DETAIL_CONTENT = {
    "1": {
        image: "images/sign1.png",
        imageAlt: "Illustration : reconnaissance des signes en situation conversationnelle.",
        title: "Reconnaissance en direct",
        bodyHtml: `<p>SignVue analyse le flux vidéo en continu pour repérer les configurations de mains, l’orientation des paumes et le rythme des mouvements propres à la langue des signes. L’objectif n’est pas seulement de reconnaître un signe isolé, mais de suivre le débit d’une vraie conversation : enchaînements rapides, coarticulations et micro-pauses.</p><p>Le modèle est calibré pour limiter la latence perçue : les résultats se mettent à jour au fil de l’écran, ce qui permet à l’interlocuteur entendant de lire ou d’écouter une reformulation presque au même rythme que le signeur. Cette fluidité est essentielle pour éviter la fatigue cognitive et garder un échange naturel.</p><p>Sur le plan technique, la détection combine une piste « squelette » des mains avec des critères visuels adaptés à la LSF et à l’ASL, afin de rester robuste face aux variations d’éclairage, de fond ou de cadrage webcam grand public.</p>`,
    },
    "2": {
        image: "images/sign6.png",
        imageAlt: "Illustration : texte et voix comme pont entre signes et entendants.",
        title: "Texte & synthèse vocale",
        bodyHtml: `<p>Chaque séquence reconnue est affichée sous forme de texte clair, ponctué et hiérarchisé : mots ou groupes de mots, confiance relative, et possibilité d’ajouter des corrections utilisateur dans des versions ultérieures du prototype.</p><p>La synthèse vocale prolonge ce canal : la même chaîne de traitement peut piloter une voix de lecture, avec réglage du débit et des pauses pour coller au débit du signeur. L’architecture prévoit des sorties multiples (écran, audio, export) à partir d’une seule interprétation, ce qui facilite l’intégration dans un poste de travail, une borne ou un visioconférence.</p><p>Pour les équipes produit, cette couche « texte d’abord » permet aussi d’ajouter des glossaires métier, des synonymes ou des reformulations contrôlées avant la voix — utile dans les contextes administratifs ou médicaux où la précision prime sur la vitesse.</p>`,
    },
    "3": {
        image: "images/sign7.png",
        imageAlt: "Illustration : protection des données et flux vidéo.",
        title: "Respect de la vie privée",
        bodyHtml: `<p>La vidéo brute n’est pas conservée comme archive par défaut : le prototype privilégie des traitements en mémoire ou des fenêtres temporelles courtes, puis ne garde que le strict nécessaire (par exemple des statistiques d’usage anonymisées).</p><p>Les flux peuvent rester sur l’appareil lorsque le navigateur et le modèle le permettent, ce qui réduit l’exposition réseau. Lorsqu’un envoi serveur est nécessaire, la documentation prévoit chiffrement en transit, minimisation des métadonnées et politiques de rétention explicites — jalons indispensables avant tout déploiement réel.</p><p>Enfin, l’interface rappelle à l’utilisateur quand la caméra est active, propose d’interrompre la capture en un geste, et évite les surprises : transparence et contrôle sont au même niveau que la qualité de reconnaissance.</p>`,
    },
};

function normalizeEmail(email) {
    return String(email).trim().toLowerCase();
}

let currentUser = null;

async function getAuthToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
}

function getSessionEmail() {
    return currentUser?.email || '';
}

function isLoggedIn() {
    return !!currentUser;
}

async function apiFetch(path, options = {}) {
    const token = await getAuthToken();
    const headers = { ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = path.startsWith('http') ? path : apiUrl(path);
    return fetch(url, { ...options, headers });
}

async function supabaseRegister(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
}

async function supabaseLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
}

function showAuthError(message) {
    if (!authError) return;
    authError.textContent = message;
    authError.hidden = false;
}

function clearAuthError() {
    if (!authError) return;
    authError.textContent = "";
    authError.hidden = true;
}

function setAuthTab(mode) {
    const isLogin = mode === "login";
    if (tabLogin && tabRegister) {
        tabLogin.classList.toggle("is-active", isLogin);
        tabRegister.classList.toggle("is-active", !isLogin);
        tabLogin.setAttribute("aria-selected", isLogin ? "true" : "false");
        tabRegister.setAttribute("aria-selected", !isLogin ? "true" : "false");
    }
    if (formLogin && formRegister) {
        formLogin.classList.toggle("is-hidden", !isLogin);
        formRegister.classList.toggle("is-hidden", isLogin);
    }
    const title = document.getElementById("auth-dialog-title");
    if (title) title.textContent = isLogin ? "Connexion" : "Créer un compte";
}

function openAuthModal(mode = "login", intro = "") {
    clearAuthError();
    setAuthTab(mode);
    if (authIntro) authIntro.textContent = intro;
    if (authModal) {
        authModal.hidden = false;
        document.body.style.overflow = "hidden";
    }
    const first =
        mode === "login" ? document.getElementById("login-email") : document.getElementById("reg-email");
    window.requestAnimationFrame(() => first?.focus());
}

function closeAuthModal() {
    if (authModal) {
        authModal.hidden = true;
        document.body.style.overflow = "";
    }
    clearAuthError();
}

function closeUserAccountPanel() {
    if (!userAccountPanel || !userAccountBtn) return;
    userAccountPanel.hidden = true;
    userAccountBtn.setAttribute("aria-expanded", "false");
}

function toggleUserAccountPanel() {
    if (!userAccountPanel || !userAccountBtn) return;
    const open = userAccountPanel.hidden;
    userAccountPanel.hidden = !open;
    userAccountBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && userPanelEmail) {
        userPanelEmail.textContent = getSessionEmail() || "—";
    }
}

function renderAuthChrome() {
    const logged = isLoggedIn();

    if (!logged) closeUserAccountPanel();
    if (userPanelEmail) userPanelEmail.textContent = getSessionEmail() || "—";

    document.querySelectorAll(".js-demo-link").forEach((el) => {
        el.classList.toggle("btn-demo-locked", !logged);
        el.setAttribute("aria-disabled", logged ? "false" : "true");
        if (logged) {
            el.removeAttribute("title");
        } else {
            el.setAttribute("title", "Connexion requise pour la démo");
        }
    });

    if (headerBtnAuth) headerBtnAuth.classList.toggle("is-hidden", logged);
    if (headerUserBar) headerUserBar.classList.toggle("is-hidden", !logged);

    if (demoLeadDefault && demoLeadLogged) {
        demoLeadDefault.classList.toggle("is-hidden", logged);
        demoLeadLogged.classList.toggle("is-hidden", !logged);
    }
}

function pulseOutput() {
    if (!output) return;
    output.classList.remove("is-pulse");
    requestAnimationFrame(() => {
        output.classList.add("is-pulse");
    });
    window.setTimeout(() => output.classList.remove("is-pulse"), 480);
}

function clearSimulation() {
    if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
    }
}

function startSimulation() {
    clearSimulation();
    const words = ["Bonjour", "Merci", "Oui", "Non", "Aide"];
    const pick = () => {
        output.textContent = words[Math.floor(Math.random() * words.length)];
        pulseOutput();
    };
    pick();
    simInterval = setInterval(pick, 3000);
}

function startCamera() {
    if (!isLoggedIn()) {
        openAuthModal("login", "Connectez-vous pour lancer la démo caméra.");
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        if (output) output.textContent = "Caméra non supportée";
        return;
    }

    navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then((stream) => {
            video.srcObject = stream;
            video.classList.add("is-active");
            if (placeholder) placeholder.classList.add("is-hidden");
            if (playFab) playFab.classList.add("is-hidden");
            startSimulation();
            apiFetch("/api/interpretation-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: "demo-camera" }),
            }).catch(() => {});
        })
        .catch(() => {
            if (output) output.textContent = "Accès caméra refusé";
        });
}

function tryDemoFromLink() {
    if (!isLoggedIn()) {
        openAuthModal("login", "Connectez-vous pour accéder à la démo.");
        return;
    }
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => startCamera(), 450);
}

document.querySelectorAll(".js-demo-link").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        tryDemoFromLink();
    });
});

if (playFab) {
    playFab.addEventListener("click", () => startCamera());
}

document.querySelectorAll(".js-open-auth").forEach((btn) => {
    btn.addEventListener("click", () => openAuthModal("login", ""));
});

if (authClose) authClose.addEventListener("click", closeAuthModal);
if (authBackdrop) authBackdrop.addEventListener("click", closeAuthModal);

if (tabLogin) {
    tabLogin.addEventListener("click", () => {
        clearAuthError();
        setAuthTab("login");
    });
}
if (tabRegister) {
    tabRegister.addEventListener("click", () => {
        clearAuthError();
        setAuthTab("register");
    });
}

if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAuthError();
        const email = document.getElementById("login-email")?.value || "";
        const password = document.getElementById("login-password")?.value || "";
        let res;
        try {
            res = await supabaseLogin(email, password);
        } catch {
            res = { ok: false, message: "Erreur de connexion." };
        }
        if (!res.ok) {
            showAuthError(res.message);
            return;
        }
        closeAuthModal();
        renderAuthChrome();
        formLogin.reset();
    });
}

if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAuthError();
        const email = document.getElementById("reg-email")?.value || "";
        const p1 = document.getElementById("reg-password")?.value || "";
        const p2 = document.getElementById("reg-password2")?.value || "";
        if (p1.length < 6) {
            showAuthError("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }
        if (p1 !== p2) {
            showAuthError("Les mots de passe ne correspondent pas.");
            return;
        }
        let res;
        try {
            res = await supabaseRegister(email, p1);
        } catch {
            res = { ok: false, message: "Erreur d'inscription." };
        }
        if (!res.ok) {
            showAuthError(res.message);
            return;
        }
        closeAuthModal();
        renderAuthChrome();
        formRegister.reset();
    });
}

if (userAccountBtn && userAccountPanel) {
    userAccountBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleUserAccountPanel();
    });
}

document.addEventListener("click", () => {
    if (userAccountPanel && !userAccountPanel.hidden) {
        closeUserAccountPanel();
    }
});

if (userMenu) {
    userMenu.addEventListener("click", (e) => e.stopPropagation());
}

if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        closeUserAccountPanel();
        await supabase.auth.signOut();
        clearSimulation();
        if (video?.srcObject) {
            video.srcObject.getTracks().forEach((t) => t.stop());
            video.srcObject = null;
        }
        video?.classList.remove("is-active");
        if (placeholder) placeholder.classList.remove("is-hidden");
        if (playFab) playFab.classList.remove("is-hidden");
        if (output) output.textContent = "—";
        renderAuthChrome();
    });
}

function closeFeatureDetailPanel() {
    if (!featureDetailEl) return;
    featureDetailEl.hidden = true;
    openFeatureId = null;
    document.querySelectorAll(".feature-card--clickable").forEach((el) => {
        el.classList.remove("is-selected");
        el.setAttribute("aria-expanded", "false");
    });
}

function openFeatureDetailPanel(id) {
    const data = FEATURE_DETAIL_CONTENT[id];
    if (!data || !featureDetailEl || !featureDetailImg || !featureDetailTitle || !featureDetailBody) return;
    featureDetailImg.src = data.image;
    featureDetailImg.alt = data.imageAlt;
    featureDetailTitle.textContent = data.title;
    featureDetailBody.innerHTML = data.bodyHtml;
    featureDetailEl.hidden = false;
    openFeatureId = id;
    document.querySelectorAll(".feature-card--clickable").forEach((el) => {
        const on = el.dataset.feature === id;
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-expanded", on ? "true" : "false");
    });
    featureDetailEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function initFeatureDetailPanels() {
    const cards = document.querySelectorAll(".feature-card--clickable");
    if (!cards.length || !featureDetailEl) return;

    cards.forEach((card) => {
        card.addEventListener("click", () => {
            const id = card.dataset.feature;
            if (!id) return;
            if (openFeatureId === id && !featureDetailEl.hidden) {
                closeFeatureDetailPanel();
                return;
            }
            openFeatureDetailPanel(id);
        });
        card.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            card.click();
        });
    });

    if (featureDetailClose) {
        featureDetailClose.addEventListener("click", () => closeFeatureDetailPanel());
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (authModal && !authModal.hidden) {
        closeAuthModal();
        return;
    }
    if (featureDetailEl && !featureDetailEl.hidden) {
        closeFeatureDetailPanel();
        return;
    }
    if (userAccountPanel && !userAccountPanel.hidden) {
        closeUserAccountPanel();
    }
});

const navToggle = document.querySelector(".nav-toggle");
const headerInner = document.querySelector(".header-inner");
if (navToggle && headerInner) {
    navToggle.addEventListener("click", () => {
        const open = headerInner.classList.toggle("nav-open");
        navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
}

function initRevealOnScroll() {
    const nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
        nodes.forEach((el) => el.classList.add("is-visible"));
        return;
    }

    const io = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                obs.unobserve(entry.target);
            });
        },
        /* Marge généreuse : l’ancienne marge négative masquait souvent le hero au chargement */
        { threshold: 0.05, rootMargin: "0px 0px 12% 0px" }
    );

    nodes.forEach((el) => {
        if (el.classList.contains("is-visible")) return;
        io.observe(el);
    });

    requestAnimationFrame(() => {
        nodes.forEach((el) => {
            if (el.classList.contains("is-visible")) return;
            const r = el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) {
                el.classList.add("is-visible");
                io.unobserve(el);
            }
        });
    });
}

async function bootstrap() {
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        renderAuthChrome();
    });
    renderAuthChrome();
    initRevealOnScroll();
    initFeatureDetailPanels();
}

bootstrap();
