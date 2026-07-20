// roast.ts — Pure-function roast message generator with multi-language support (F3).
//
// Public API:
//   generateRoast(user, repos, score)              // default English (back-compat signature)
//   generateRoastWithLang(user, repos, score, lang) // explicit locale
//   parseAcceptLanguage(header)                    // pick best locale, fall back to 'en'
//
// Adding a new language = adding an entry to ROAST_MESSAGES. Empty entries
// degrade gracefully to English so a half-translated pack never throws.

import type { GitHubUser, GitHubRepo, ScoreBreakdown, RoastResult } from '../types.js';
import { calculateTotalStars } from './score.js';

export type RoastLocale = 'en' | 'pl' | 'es' | 'de' | 'fr';

interface RoastMessages {
  noRepos: string;
  allForks: string;
  noStars: string;
  manyReposFewStars: (repos: number, stars: number) => string;
  noFollowers: string;
  manyFollowersFewRepos: (followers: number, repos: number) => string;
  fastFood: string;
  noBio: string;
  noCompanyNoBlog: string;
  oldAccountFewRepos: (years: number, repos: number) => string;
  scoreLow: string;
  scoreHigh: string;
  oneLanguage: string;
  lowActivity: string;
  fallback: string;
  overall: {
    under100: string;
    under300: string;
    under600: string;
    under800: string;
    over800: string;
  };
}

const EN: RoastMessages = {
  noRepos: 'You signed up, saw the empty profile, and just... gave up?',
  allForks: 'Every single repo is a fork. You\'re not a developer — you\'re a librarian.',
  noStars: 'Your code is so secret, even GitHub can\'t star it. Or maybe it\'s just... not good.',
  manyReposFewStars: (repos, stars) => `${repos} repos and ${stars} stars. That\'s a star-to-repo ratio that would make a startup cry.`,
  noFollowers: 'Zero followers. You\'re coding in a void. At least your rubber duck is impressed.',
  manyFollowersFewRepos: (followers, repos) => `${followers} followers but only ${repos} repos? You\'re the influencer of GitHub — all follow, no code.`,
  fastFood: 'Quantity over quality? You\'re the fast food chain of repositories.',
  noBio: 'No bio. Are you a developer or a mystery? Even your profile is undefined.',
  noCompanyNoBlog: 'No company, no blog. You\'re a ghost with a GitHub account.',
  oldAccountFewRepos: (years, repos) => `Your account is ${years} years old with ${repos} repos. That's a repo per year. Living on the edge.`,
  scoreLow: 'Your GitHub is like a gym membership — signed up, never went.',
  scoreHigh: 'Okay, we get it. You\'re a 10x developer. Now go touch grass.',
  oneLanguage: 'One language? Really? Even Google Translate supports more.',
  lowActivity: 'Your last commit was so long ago, it\'s practically an archaeological artifact.',
  fallback: 'Honestly? Your profile is... fine. Suspiciously fine. Nobody\'s this balanced.',
  overall: {
    under100: 'Ouch. But hey, every expert was once a beginner. Start pushing code!',
    under300: 'You\'re getting there. A few more repos and some stars wouldn\'t kill you.',
    under600: 'Solid profile. You clearly know what you\'re doing. Mostly.',
    under800: 'Impressive! You\'re a proper developer. Don\'t let it go to your head.',
    over800: 'You\'re a GitHub legend. Or you bought followers. One of the two.',
  },
};

const PL: RoastMessages = {
  noRepos: 'Założyłeś konto, zobaczyłeś pusty profil i po prostu... odpuściłeś?',
  allForks: 'Każde repo to fork. Nie jesteś programistą — jesteś bibliotekarzem.',
  noStars: 'Twój kod jest tak tajny, że nawet GitHub go nie gwiazdkuje. Albo po prostu... słaby.',
  manyReposFewStars: (repos, stars) => `${repos} repo i ${stars} gwiazdek. Stosunek star-to-repo, od którego startupy by płakały.`,
  noFollowers: 'Zero followersów. Kodujesz w próżni. Przynajmniej gumowa kaczka jest pod wrażeniem.',
  manyFollowersFewRepos: (followers, repos) => `${followers} followersów, a tylko ${repos} repo? Jesteś influencerem GitHuba — samo follow, zero kodu.`,
  fastFood: 'Ilość nad jakość? Jesteś fast-foodem repozytoriów.',
  noBio: 'Brak bio. Programista czy zagadka? Nawet twój profil jest undefined.',
  noCompanyNoBlog: 'Brak firmy, brak bloga. Jesteś duchem z kontem GitHub.',
  oldAccountFewRepos: (years, repos) => `Twoje konto ma ${years} lat i ${repos} repo. To jedno repo rocznie. Żyjesz na krawędzi.`,
  scoreLow: 'Twój GitHub to jak karnet na siłownię — zapisałeś się i nigdy nie poszedłeś.',
  scoreHigh: 'Dobra, jasne. Jesteś 10x developerem. Teraz idź dotknąć trawę.',
  oneLanguage: 'Jeden język? Serio? Nawet Google Translate obsługuje więcej.',
  lowActivity: 'Twój ostatni commit był tak dawno, że można go uznać za artefakt archeologiczny.',
  fallback: 'Szczerze? Twój profil jest... okej. Podejrzanie okej. Nikt nie jest tak wybalansowany.',
  overall: {
    under100: 'Łoł. Ale każdy ekspert był kiedyś początkujący. Zacznij pushować kod!',
    under300: 'Idzie ci. Kilka repo i parę gwiazdek by nie zaszkodziło.',
    under600: 'Solidny profil. Wiesz, co robisz. W większości.',
    under800: 'Imponujące! Jesteś prawdziwym developerem. Niech ci nie uderzy do głowy.',
    over800: 'Jesteś legendą GitHuba. Albo kupiłeś followersów. Jedno z dwóch.',
  },
};

const ES: RoastMessages = {
  noRepos: 'Te registraste, viste el perfil vacío y... ¿simplemente te rendiste?',
  allForks: 'Cada repositorio es un fork. No eres desarrollador — eres bibliotecario.',
  noStars: 'Tu código es tan secreto que ni GitHub lo estrella. O quizás... simplemente no es bueno.',
  manyReposFewStars: (repos, stars) => `${repos} repos y ${stars} estrellas. Una proporción estrella-repo que haría llorar a una startup.`,
  noFollowers: 'Cero seguidores. Estás programando en el vacío. Al menos tu pato de goma está impresionado.',
  manyFollowersFewRepos: (followers, repos) => `¿${followers} seguidores pero solo ${repos} repos? Eres el influencer de GitHub — todo follow, nada código.`,
  fastFood: '¿Cantidad sobre calidad? Eres la cadena de comida rápida de los repositorios.',
  noBio: 'Sin bio. ¿Eres desarrollador o un misterio? Incluso tu perfil es undefined.',
  noCompanyNoBlog: 'Sin empresa, sin blog. Eres un fantasma con cuenta de GitHub.',
  oldAccountFewRepos: (years, repos) => `Tu cuenta tiene ${years} años y ${repos} repos. Un repo por año. Viviendo al límite.`,
  scoreLow: 'Tu GitHub es como la membresía del gimnasio — inscrito, nunca fuiste.',
  scoreHigh: 'Vale, ya. Eres un desarrollador 10x. Ahora ve a tocar el césped.',
  oneLanguage: '¿Un solo lenguaje? ¿En serio? Hasta Google Translate soporta más.',
  lowActivity: 'Tu último commit fue hace tanto que prácticamente es un hallazgo arqueológico.',
  fallback: '¿Honestamente? Tu perfil está... bien. Sospechosamente bien. Nadie es tan equilibrado.',
  overall: {
    under100: 'Ay. Pero todo experto fue principiante. ¡Empieza a pushear código!',
    under300: 'Vas por buen camino. Un par de repos y estrellas más no te vendrían mal.',
    under600: 'Perfil sólido. Sabes lo que haces. Casi siempre.',
    under800: '¡Impresionante! Eres un desarrollador de verdad. Que no se te suba a la cabeza.',
    over800: 'Eres una leyenda de GitHub. O compraste seguidores. Una de dos.',
  },
};

const DE: RoastMessages = {
  noRepos: 'Konto erstellt, leeres Profil gesehen und dann... einfach aufgegeben?',
  allForks: 'Jedes Repo ist ein Fork. Du bist kein Entwickler — du bist Bibliothekar.',
  noStars: 'Dein Code ist so geheim, dass nichtmal GitHub ihn starrt. Oder er ist einfach... nicht gut.',
  manyReposFewStars: (repos, stars) => `${repos} Repos und ${stars} Sterne. Diese Stern-zu-Repo-Rate bringt Startups zum Weinen.`,
  noFollowers: 'Null Follower. Du programmierst im Nichts. Zumindest dein Quietsche-Entchen ist beeindruckt.',
  manyFollowersFewRepos: (followers, repos) => `${followers} Follower, aber nur ${repos} Repos? Du bist der Influencer von GitHub — alles Follow, kein Code.`,
  fastFood: 'Quantität über Qualität? Du bist die Fast-Food-Kette der Repositories.',
  noBio: 'Kein Bio. Bist du Entwickler oder ein Rätsel? Sogar dein Profil ist undefined.',
  noCompanyNoBlog: 'Keine Firma, kein Blog. Du bist ein Geist mit GitHub-Konto.',
  oldAccountFewRepos: (years, repos) => `Dein Konto ist ${years} Jahre alt mit ${repos} Repos. Ein Repo pro Jahr. Du lebst gefährlich.`,
  scoreLow: 'Dein GitHub ist wie eine Fitnessstudio-Mitgliedschaft — eingetragen, nie hingegangen.',
  scoreHigh: 'Okay, wir haben es verstanden. Du bist ein 10x-Entwickler. Geh jetzt Gras anfassen.',
  oneLanguage: 'Eine Sprache? Wirklich? Sogar Google Translate unterstützt mehr.',
  lowActivity: 'Dein letzter Commit ist so lange her, dass er praktisch ein archäologisches Artefakt ist.',
  fallback: 'Ehrlich? Dein Profil ist... okay. Verdächtig okay. Niemand ist so ausgewogen.',
  overall: {
    under100: 'Autsch. Aber jeder Experte war mal Anfänger. Fang an Code zu pushen!',
    under300: 'Du kommst voran. Ein paar Repos und Sterne mehr würden nicht schaden.',
    under600: 'Solides Profil. Du weißt, was du tust. Meistens.',
    under800: 'Beeindruckend! Du bist ein echter Entwickler. Lass dir das nicht zu Kopf steigen.',
    over800: 'Du bist eine GitHub-Legende. Oder du hast Follower gekauft. Eines von beiden.',
  },
};

const FR: RoastMessages = {
  noRepos: 'Compte créé, profil vide vu et... simplement abandonné ?',
  allForks: 'Chaque repo est un fork. Tu n\'es pas développeur — tu es bibliothécaire.',
  noStars: 'Ton code est si secret que même GitHub ne le star pas. Ou peut-être... il est nul.',
  manyReposFewStars: (repos, stars) => `${repos} repos et ${stars} étoiles. Un ratio étoile/repo qui ferait pleurer une startup.`,
  noFollowers: 'Zéro followers. Tu codes dans le vide. Au moins ton canard en plastique est impressionné.',
  manyFollowersFewRepos: (followers, repos) => `${followers} followers mais seulement ${repos} repos ? T\'es l\'influenceur de GitHub — que du follow, pas de code.`,
  fastFood: 'La quantité plutôt que la qualité ? T\'es le fast-food des dépôts.',
  noBio: 'Pas de bio. T\'es dev ou un mystère ? Même ton profil est undefined.',
  noCompanyNoBlog: 'Pas de boîte, pas de blog. T\'es un fantôme avec un compte GitHub.',
  oldAccountFewRepos: (years, repos) => `Ton compte a ${years} ans et ${repos} repos. Un repo par an. Tu vis dangereusement.`,
  scoreLow: 'Ton GitHub c\'est comme une inscription à la salle — inscrit, jamais allé.',
  scoreHigh: 'D\'accord, on a compris. T\'es un dev 10x. Maintenant va toucher l\'herbe.',
  oneLanguage: 'Un seul langage ? Sérieux ? Même Google Translate en supporte plus.',
  lowActivity: 'Ton dernier commit est si ancien que c\'est presque un artefact archéologique.',
  fallback: 'Honnêtement ? Ton profil est... correct. Suspectement correct. Personne n\'est aussi équilibré.',
  overall: {
    under100: 'Aïe. Mais tout expert a été débutant. Commence à push du code !',
    under300: 'Tu progresses. Quelques repos et étoiles en plus ne te tueraient pas.',
    under600: 'Profil solide. Tu sais ce que tu fais. En général.',
    under800: 'Impressionnant ! T\'es un vrai dev. Que ça ne te monte pas à la tête.',
    over800: 'T\'es une légende de GitHub. Ou tu as acheté des followers. Probablement l\'un des deux.',
  },
};

const ROAST_MESSAGES: Record<RoastLocale, RoastMessages> = {
  en: EN,
  pl: PL,
  es: ES,
  de: DE,
  fr: FR,
};

function messagesFor(lang: string): RoastMessages {
  const key = (lang || 'en').toLowerCase().split('-')[0] as RoastLocale;
  return ROAST_MESSAGES[key] ?? ROAST_MESSAGES.en;
}

/** Parses an HTTP `Accept-Language` header and returns the best matching locale. */
export function parseAcceptLanguage(header: string | undefined): RoastLocale {
  if (!header) return 'en';
  const candidates = header
    .split(',')
    .map(s => s.trim().split(';')[0].toLowerCase())
    .filter(Boolean);
  const supported: RoastLocale[] = ['en', 'pl', 'es', 'de', 'fr'];
  for (const c of candidates) {
    const base = c.split('-')[0] as RoastLocale;
    if (supported.includes(base)) return base;
  }
  return 'en';
}

/** Backwards-compatible generator (English default). */
export function generateRoast(user: GitHubUser, repos: GitHubRepo[], score: ScoreBreakdown): RoastResult {
  return generateRoastWithLang(user, repos, score, 'en');
}

/** Locale-aware variant. Falls back to English for missing entries. */
export function generateRoastWithLang(
  user: GitHubUser,
  repos: GitHubRepo[],
  score: ScoreBreakdown,
  lang: string,
): RoastResult {
  const m = messagesFor(lang);
  const fallback = ROAST_MESSAGES.en;
  const get = <K extends keyof RoastMessages>(key: K): RoastMessages[K] => (m[key] ?? fallback[key]);

  const lines: string[] = [];
  const totalStars = calculateTotalStars(repos);
  const nonForkedRepos = repos.filter(r => !r.fork);
  const ownRepos = nonForkedRepos.length;

  if (user.public_repos === 0) {
    lines.push(get('noRepos'));
  }

  if (user.public_repos > 0 && ownRepos === 0) {
    lines.push(get('allForks'));
  }

  if (totalStars === 0 && user.public_repos > 0) {
    lines.push(get('noStars'));
  }

  if (totalStars < 5 && user.public_repos > 10) {
    lines.push(get('manyReposFewStars')(user.public_repos, totalStars));
  }

  if (user.followers === 0) {
    lines.push(get('noFollowers'));
  }

  if (user.followers > 0 && user.followers > user.public_repos * 5) {
    lines.push(get('manyFollowersFewRepos')(user.followers, user.public_repos));
  }

  if (user.public_repos > 30 && totalStars < 10) {
    lines.push(get('fastFood'));
  }

  if (user.bio === null) {
    lines.push(get('noBio'));
  }

  if (user.company === null && user.blog === null) {
    lines.push(get('noCompanyNoBlog'));
  }

  const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (accountAgeDays > 365 && user.public_repos < 5) {
    lines.push(get('oldAccountFewRepos')(Math.floor(accountAgeDays / 365), user.public_repos));
  }

  if (score.total < 100) {
    lines.push(get('scoreLow'));
  }

  if (score.total >= 800) {
    lines.push(get('scoreHigh'));
  }

  if (score.diversity < 20 && user.public_repos > 5) {
    lines.push(get('oneLanguage'));
  }

  if (score.activity < 30) {
    lines.push(get('lowActivity'));
  }

  let overall: string;
  if (score.total < 100) {
    overall = get('overall').under100;
  } else if (score.total < 300) {
    overall = get('overall').under300;
  } else if (score.total < 600) {
    overall = get('overall').under600;
  } else if (score.total < 800) {
    overall = get('overall').under800;
  } else {
    overall = get('overall').over800;
  }

  if (lines.length === 0) {
    lines.push(get('fallback'));
  }

  return { lines, overall };
}