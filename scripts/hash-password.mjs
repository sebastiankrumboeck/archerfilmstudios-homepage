// Generates a `salt$hash` password hash matching workers/src/auth.js.
// Usage: node scripts/hash-password.mjs <password>
const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}
const salt = [...crypto.getRandomValues(new Uint8Array(16))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
console.log(`${salt}$${hash}`);
