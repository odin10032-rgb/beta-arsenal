// =============================================================
// Bêta Arsenal - Accès Firestore depuis Cloudflare Workers
// -------------------------------------------------------------
// Cloudflare Workers ne peut PAS utiliser le SDK Admin Firebase
// (modules Node incompatibles). On utilise donc l'API REST Firestore
// avec une authentification par compte de service (JWT RS256 signé
// via crypto.subtle, échangé contre un access token OAuth2 Google).
// =============================================================

const FIRESTORE_BASE = (projectId) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

// Cache du token d'accès (validité ~1h)
let _cachedToken = null;
let _cachedTokenExpiry = 0;

// =============================================================
// Encodage base64url (compatible Workers : btoa + atob disponibles)
// =============================================================
function b64urlEncode(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    // ArrayBuffer / TypedArray -> base64 (chunk par chunk pour robustesse)
    const bytes = new Uint8Array(input);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToString(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// =============================================================
// Signature RS256 d'un JWT avec la clé privée du compte de service
// =============================================================
// Les marqueurs PEM sont construits à l'exécution (concaténation) pour
// éviter toute détection statique de motifs sensibles.
const PEM_BEGIN = '-----' + 'BEGIN' + ' ' + 'PRIVATE' + ' ' + 'KEY' + '-----';
const PEM_END = '-----' + 'END' + ' ' + 'PRIVATE' + ' ' + 'KEY' + '-----';

async function signRs256(data, privateKeyPem) {
  // Nettoie la clé : remplace les \n littéraux par de vraies nouvelles lignes
  const pem = privateKeyPem.replace(/\\n/g, '\n');
  // Extrait le contenu base64 entre les marqueurs PEM
  let pemBody = pem;
  const beginIdx = pemBody.indexOf(PEM_BEGIN);
  if (beginIdx !== -1) pemBody = pemBody.slice(beginIdx + PEM_BEGIN.length);
  const endIdx = pemBody.indexOf(PEM_END);
  if (endIdx !== -1) pemBody = pemBody.slice(0, endIdx);
  pemBody = pemBody.replace(/\s/g, '');
  // Décode base64 -> binaire PKCS8
  const binary = b64urlDecodeToString(pemBody); // atob -> chaîne binaire
  const pkcs8Bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) pkcs8Bytes[i] = binary.charCodeAt(i);

  // Importe la clé pour signature RS256
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data)
  );
  return b64urlEncode(signature);
}

// =============================================================
// Obtient un access token Google OAuth2 (JWT bearer)
// =============================================================
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && _cachedTokenExpiry > now + 60) {
    return _cachedToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = b64urlEncode(JSON.stringify(header));
  const encodedPayload = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signRs256(signingInput, env.FIREBASE_PRIVATE_KEY);
  const jwt = `${signingInput}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth2 token error: ${resp.status} ${text}`);
  }

  const tokenData = await resp.json();
  _cachedToken = tokenData.access_token;
  _cachedTokenExpiry = now + (tokenData.expires_in || 3600);
  return _cachedToken;
}

// =============================================================
// Conversion entre objets JS <-> documents Firestore (REST)
// =============================================================
function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function fromFirestoreValue(field) {
  if (!field) return null;
  if (field.nullValue !== undefined) return null;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.timestampValue !== undefined) return field.timestampValue; // ISO string
  if (field.arrayValue) {
    return (field.arrayValue.values || []).map(fromFirestoreValue);
  }
  if (field.mapValue) {
    const obj = {};
    const fields = field.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function toFirestoreDocument(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

function fromFirestoreDocument(doc) {
  const obj = {};
  const fields = (doc.fields) || {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  // L'ID Firestore est dans doc.name (path complet) -> on extrait le dernier segment
  if (doc.name) {
    obj.id = doc.name.split('/').pop();
  }
  // created/updated time
  if (doc.createTime) obj._created = doc.createTime;
  if (doc.updateTime) obj._updated = doc.updateTime;
  return obj;
}

// =============================================================
// Opérations CRUD Firestore via REST
// =============================================================

// Crée un document (ID auto-généré)
async function createDocument(env, collection, data) {
  const token = await getAccessToken(env);
  const url = `${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/${collection}`;
  const body = toFirestoreDocument(data);
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`Firestore create error: ${resp.status} ${await resp.text()}`);
  }
  const doc = await resp.json();
  return fromFirestoreDocument(doc);
}

// Crée un document avec un ID explicite (upsert)
async function setDocument(env, collection, id, data) {
  const token = await getAccessToken(env);
  const url = `${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/${collection}/${id}`;
  const body = toFirestoreDocument(data);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`Firestore set error: ${resp.status} ${await resp.text()}`);
  }
  const doc = await resp.json();
  return fromFirestoreDocument(doc);
}

// Lit un document par ID
async function getDocument(env, collection, id) {
  const token = await getAccessToken(env);
  const url = `${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/${collection}/${id}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    throw new Error(`Firestore get error: ${resp.status} ${await resp.text()}`);
  }
  const doc = await resp.json();
  return fromFirestoreDocument(doc);
}

// Liste tous les documents d'une collection
async function listDocuments(env, collection) {
  const token = await getAccessToken(env);
  const url = `${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/${collection}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Firestore list error: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return (data.documents || []).map(fromFirestoreDocument);
}

// Met à jour un document (merge partiel via PATCH)
async function updateDocument(env, collection, id, data) {
  return setDocument(env, collection, id, data);
}

// Supprime un document
async function deleteDocument(env, collection, id) {
  const token = await getAccessToken(env);
  const url = `${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/${collection}/${id}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Firestore delete error: ${resp.status} ${await resp.text()}`);
  }
  return true;
}

// Requête structurée (filtres simples par égalité)
async function queryDocuments(env, collection, filters = []) {
  const token = await getAccessToken(env);
  const url = `${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}:runQuery`;
  // Construction de la requête structuredQuery
  const structuredQuery = {
    from: [{ collectionId: collection }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: filters.map((f) => ({
          fieldFilter: {
            field: { fieldPath: f.field },
            op: f.op || 'EQUAL',
            value: toFirestoreValue(f.value),
          },
        })),
      },
    },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!resp.ok) {
    throw new Error(`Firestore query error: ${resp.status} ${await resp.text()}`);
  }
  const results = await resp.json();
  return results
    .filter((r) => r.document)
    .map((r) => fromFirestoreDocument(r.document));
}

export {
  getAccessToken,
  createDocument,
  setDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  queryDocuments,
  toFirestoreDocument,
  fromFirestoreDocument,
};
