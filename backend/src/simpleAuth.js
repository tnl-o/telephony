/**
 * Dev-only auth: map username -> password from DEV_USERS env.
 * Format: user1:pass1,user2:pass2 (password may contain ':' if using last split — keep passwords simple).
 */
function parseDevUsers(env) {
  const map = new Map();
  if (!env || typeof env !== 'string') return map;
  for (const segment of env.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const username = trimmed.slice(0, idx).trim().toLowerCase();
    const password = trimmed.slice(idx + 1).trim();
    if (username && password) map.set(username, password);
  }
  return map;
}

function buildSimpleAuth() {
  const map = parseDevUsers(process.env.DEV_USERS);
  console.log('[SimpleAuth] DEV_USERS map:', Object.fromEntries(map));
  return {
    map,
    async authenticate(username, password) {
      const key = String(username).trim().toLowerCase();
      const expected = map.get(key);
      console.log(`[SimpleAuth] Attempt: username="${key}", provided="${password}", expected="${expected}"`);
      if (expected === undefined || expected !== password) {
        throw new Error('Invalid credentials');
      }
      const pretty = key.length ? key.charAt(0).toUpperCase() + key.slice(1) : key;
      return {
        username: key,
        displayName: pretty,
        email: `${username}@dev.local`,
        department: 'Dev',
        telephoneNumber: null,
        dn: `uid=${username},ou=dev,dc=local`
      };
    }
  };
}

module.exports = { parseDevUsers, buildSimpleAuth };
