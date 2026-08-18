// =============================================================
// Bêta Arsenal - Upload d'images sur GitHub
// -------------------------------------------------------------
// Les images illustrant les produits sont stockées directement
// dans le dépôt GitHub (branche main, dossier public/uploads/products)
// via l'API GitHub Contents. L'URL brute renvoyée est du type :
//   https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>
//
// Configuration requise (vars + secret Worker) :
//   GITHUB_REPO_OWNER   (var)
//   GITHUB_REPO_NAME    (var)
//   GITHUB_BRANCH       (var, défaut "main")
//   GITHUB_IMAGE_PATH   (var, défaut "public/uploads/products")
//   GITHUB_TOKEN        (secret) — fine-grained PAT avec permission
//                      "Contents: Read and write" sur le dépôt.
// =============================================================

const GITHUB_API = 'https://api.github.com';

// =============================================================
// Upload d'une image vers GitHub
// -------------------------------------------------------------
// Reçoit : { filename, base64Content, contentType }
// Renvoie : { url, path, sha }  (url = raw.githubusercontent.com)
// =============================================================
export async function uploadImageToGitHub(env, { filename, base64Content }) {
  if (!env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN non configuré');
  }
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;
  const branch = env.GITHUB_BRANCH || 'main';
  const basePath = env.GITHUB_IMAGE_PATH || 'public/uploads/products';

  if (!owner || !repo) {
    throw new Error('GITHUB_REPO_OWNER et GITHUB_REPO_NAME doivent être configurés');
  }

  // Nom de fichier unique pour éviter les collisions
  const uniqueFilename = makeUniqueFilename(filename);
  const path = `${basePath}/${uniqueFilename}`;

  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;

  const body = {
    message: `chore(uploads): add product image ${uniqueFilename}`,
    content: base64Content, // déjà en base64 sans préfixe data URI
    branch,
  };

  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub upload error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  // data.content.download_url = URL brute raw.githubusercontent.com
  const rawUrl = data.content?.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

  return {
    url: rawUrl,
    path,
    sha: data.content?.sha,
  };
}

// Génère un nom de fichier unique : <timestamp>_<random>_<originalname>
function makeUniqueFilename(original) {
  const safe = String(original || 'image.png')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}_${rand}_${safe}`;
}
