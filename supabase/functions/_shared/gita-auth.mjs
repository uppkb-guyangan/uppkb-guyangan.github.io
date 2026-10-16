// Firebase ID-token verification, online revocation check, then live Firestore role.
// No client-supplied roles or Supabase public keys are accepted as identity.
export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
const fail = (status, code) => { throw new HttpError(status, code); };
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export function createFirebaseAuthorizer({projectId, apiKey, fetcher = fetch, now = () => Date.now(), cryptoApi = crypto}) {
  let jwks, expires = 0;
  async function getJson(url, options = {}) {
    const r = await fetcher(url, {...options, signal: AbortSignal.timeout(10000)});
    if (!r.ok) fail(r.status === 400 || r.status === 401 ? 401 : 503, 'IDENTITY_UNAVAILABLE');
    return r.json();
  }
  return async function authorize(req, {developer = false, allowedUids = []} = {}) {
    if (!projectId || !apiKey) fail(503, 'IDENTITY_NOT_CONFIGURED');
    const token = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.get('authorization') || '')?.[1];
    if (!token || token.length > 8192) fail(401, 'UNAUTHORIZED');
    let header, claims, signature, parts;
    try {
      parts = token.split('.');
      if (parts.length !== 3) throw 0;
      header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
      claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
      signature = decode(parts[2]);
    } catch { fail(401, 'UNAUTHORIZED'); }
    const seconds = Math.floor(now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
        claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
        typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
        !Number.isInteger(claims.exp) || claims.exp <= seconds ||
        !Number.isInteger(claims.iat) || claims.iat > seconds ||
        !Number.isInteger(claims.auth_time) || claims.auth_time > seconds) fail(401, 'UNAUTHORIZED');
    if (!jwks || expires < now()) {
      jwks = await getJson('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
      expires = now() + 300000;
    }
    const jwk = jwks?.keys?.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) { expires = 0; fail(401, 'UNAUTHORIZED'); }
    try {
      const key = await cryptoApi.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
      const valid = await cryptoApi.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(parts[0]+'.'+parts[1]));
      if (!valid) fail(401, 'UNAUTHORIZED');
    } catch { fail(401, 'UNAUTHORIZED'); }
    const lookup = await getJson('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(apiKey), {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({idToken:token})
    });
    const user = lookup?.users?.[0];
    if (!user || user.localId !== claims.sub || user.disabled === true ||
        Number(user.validSince || 0) > claims.auth_time) fail(401, 'UNAUTHORIZED');
    const profileResponse = await fetcher(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(claims.sub)}`, {
      headers:{Authorization:'Bearer '+token}, signal:AbortSignal.timeout(10000)
    });
    if (!profileResponse.ok) fail(profileResponse.status >= 500 ? 503 : 403, 'PROFILE_UNAVAILABLE');
    const fields = (await profileResponse.json())?.fields;
    const role = String(fields?.role?.stringValue || '').trim().toUpperCase();
    if (fields?.aktif?.booleanValue !== true || !role) fail(403, 'FORBIDDEN');
    if (developer && (!['ADMIN','WASATPEL'].includes(role) || !allowedUids.includes(claims.sub))) fail(403, 'FORBIDDEN');
    return {uid:claims.sub, role, token};
  };
}
