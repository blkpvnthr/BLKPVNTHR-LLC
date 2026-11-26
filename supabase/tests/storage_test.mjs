// Storage RLS end-to-end test via supabase-js with a real AAL2 session.
// Run from the worktree dir so @supabase/supabase-js resolves.
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const URL = 'https://gbaepwxbatrctxoyeysm.supabase.co';
const PUB = 'sb_publishable_pYgIWLqcbAuQYZUnMXylLQ_ipw34blJ';
const ORG = '0b1c0000-0000-0000-0000-000000000001';
const FAKE_ORG = '00000000-0000-0000-0000-0000000000ff';
const SCRATCH = '/private/tmp/claude-501/-Users-blkpvnthr-Desktop-BLKPVNTHR-LLC/fab01222-b20e-472e-98be-9e25c3b82fcd/scratchpad';
const SECRET = readFileSync(`${SCRATCH}/bootstrap_secret.txt`, 'utf8').trim();
const EMAIL = 'storage-qa@blkpvnthr.com';

let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };

function b32d(b) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let s = ''; for (const c of b.replace(/=+$/, '').toUpperCase()) if (A.indexOf(c) >= 0) s += A.indexOf(c).toString(2).padStart(5, '0'); const o = []; for (let i = 0; i + 8 <= s.length; i += 8) o.push(parseInt(s.slice(i, i + 8), 2)); return Buffer.from(o); }
function totp(sec) { const k = b32d(sec); const t = Math.floor(Date.now() / 1000 / 30); const b = Buffer.alloc(8); b.writeBigInt64BE(BigInt(t)); const h = crypto.createHmac('sha1', k).update(b).digest(); const o = h[h.length - 1] & 0xf; const c = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff); return String(c % 1000000).padStart(6, '0'); }

(async () => {
  // Bootstrap a throwaway admin.
  const bs = await (await fetch(`${URL}/functions/v1/bootstrap-owner`, { method: 'POST', headers: { 'x-bootstrap-secret': SECRET, apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, role: 'administrator' }) })).json();
  const PW = bs.temporaryPassword;
  ok('bootstrap storage-qa', bs.ok === true && !!PW);

  // AAL1 client (password only).
  const aal1 = createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  const si = await aal1.auth.signInWithPassword({ email: EMAIL, password: PW });
  ok('sign in', !si.error, si.error && si.error.message);

  // AAL1 upload must be denied (MFA required).
  const up1 = await aal1.storage.from('documents').upload(`${ORG}/aal1-${Date.now()}.txt`, Buffer.from('x'), { contentType: 'text/plain' });
  ok('aal1 upload DENIED (MFA required)', !!up1.error, up1.error ? up1.error.message : 'unexpectedly allowed');

  // Enroll TOTP + verify → AAL2 (same client).
  const en = await aal1.auth.mfa.enroll({ factorType: 'totp' });
  ok('enroll totp', !en.error && !!en.data.totp.secret);
  const ch = await aal1.auth.mfa.challenge({ factorId: en.data.id });
  const vr = await aal1.auth.mfa.verify({ factorId: en.data.id, challengeId: ch.data.id, code: totp(en.data.totp.secret) });
  ok('verify → aal2', !vr.error, vr.error && vr.error.message);
  const aal2 = aal1; // session upgraded in-place

  // AAL2 upload to own org → allowed.
  const key = `${ORG}/qa/storage-test-${Date.now()}.txt`;
  const up2 = await aal2.storage.from('documents').upload(key, Buffer.from('hello vault'), { contentType: 'text/plain' });
  ok('aal2 upload own-org ALLOWED', !up2.error, up2.error && up2.error.message);

  // AAL2 upload to a DIFFERENT org path → denied (cross-org).
  const upX = await aal2.storage.from('documents').upload(`${FAKE_ORG}/x-${Date.now()}.txt`, Buffer.from('x'), { contentType: 'text/plain' });
  ok('aal2 upload cross-org DENIED', !!upX.error, upX.error ? upX.error.message : 'unexpectedly allowed');

  // AAL2 signed download URL for own object → issued.
  const sgn = await aal2.storage.from('documents').createSignedUrl(key, 60);
  ok('aal2 signed URL issued', !sgn.error && !!sgn.data?.signedUrl, sgn.error && sgn.error.message);

  // The signed URL actually downloads the content.
  if (sgn.data?.signedUrl) {
    const dl = await fetch(sgn.data.signedUrl);
    const body = await dl.text();
    ok('signed URL downloads content', dl.status === 200 && body === 'hello vault', `status=${dl.status}`);
  }

  // Anonymous client → cannot download the object directly.
  const anon = createClient(URL, PUB, { auth: { persistSession: false } });
  const anonDl = await anon.storage.from('documents').download(key);
  ok('anon download DENIED', !!anonDl.error, anonDl.error ? anonDl.error.message : 'unexpectedly allowed');

  // Cleanup: remove the test object.
  await aal2.storage.from('documents').remove([key]);

  console.log(`\n== ${pass} passed, ${fail} failed ==`);
  process.exit(fail ? 1 : 0);
})();
