// Device-local WebAuthn gate. This deliberately does not claim to encrypt IndexedDB.
import { sessionProfileId } from "./profiles";
const key = sessionProfileId === "legacy" ? "crystal-device-credential" : `clara-lock-${sessionProfileId}`;
const enc = (v: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(v)));
const dec = (v: string) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
const b64url = (v: Uint8Array) =>
  enc(v.buffer as ArrayBuffer)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
export const hasLock = () => !!localStorage.getItem(key);
export const disableLock = () => localStorage.removeItem(key);
export async function enableLock() {
  if (!window.isSecureContext || !window.PublicKeyCredential)
    throw new Error(
      "Este navegador requiere HTTPS y un autenticador compatible.",
    );
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Clara" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: "crystal-local",
        displayName: "Mi cuenta Clara",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No se creó la credencial.");
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey?.();
  if (!publicKey)
    throw new Error(
      "Tu navegador no permite verificar credenciales sin servidor.",
    );
  const stored = { id: enc(credential.rawId), publicKey: enc(publicKey) };
  await verify(stored);
  localStorage.setItem(key, JSON.stringify(stored));
}
export async function unlock() {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  await verify(JSON.parse(raw));
}
function derToRaw(sig: Uint8Array) {
  if (sig[0] !== 0x30) throw new Error("Firma inválida");
  let i = 2;
  if (sig[i++] !== 2) throw new Error("Firma inválida");
  const r = sig.slice(i + 1, i + 1 + sig[i]);
  i += 1 + sig[i];
  if (sig[i++] !== 2) throw new Error("Firma inválida");
  const s = sig.slice(i + 1, i + 1 + sig[i]);
  const out = new Uint8Array(64);
  out.set(r.slice(-32), 32 - Math.min(32, r.length));
  out.set(s.slice(-32), 64 - Math.min(32, s.length));
  return out;
}
async function verify(stored: { id: string; publicKey: string }) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: dec(stored.id), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!credential || enc(credential.rawId) !== stored.id)
    throw new Error("No se pudo verificar tu identidad.");
  const response = credential.response as AuthenticatorAssertionResponse;
  const client = JSON.parse(new TextDecoder().decode(response.clientDataJSON));
  if (
    client.type !== "webauthn.get" ||
    client.origin !== location.origin ||
    client.challenge !== b64url(challenge) ||
    client.crossOrigin
  )
    throw new Error("La verificación de identidad no coincide.");
  const auth = new Uint8Array(response.authenticatorData);
  if (!(auth[32] & 4) || !(auth[32] & 1))
    throw new Error("El dispositivo no verificó tu identidad.");
  const rpHash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(location.hostname),
    ),
  );
  if (!rpHash.every((b, i) => b === auth[i]))
    throw new Error("Credencial de otro sitio.");
  const clientHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", response.clientDataJSON),
  );
  const signed = new Uint8Array(auth.length + clientHash.length);
  signed.set(auth);
  signed.set(clientHash, auth.length);
  const pub = await crypto.subtle.importKey(
    "spki",
    dec(stored.publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pub,
    derToRaw(new Uint8Array(response.signature)),
    signed,
  );
  if (!valid) throw new Error("La firma del dispositivo no es válida.");
}
