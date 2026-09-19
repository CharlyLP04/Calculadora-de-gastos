import Dexie, { type Table } from "dexie";

export interface Profile {
  id: string;
  name: string;
  created: number;
  googleUid?: string;
  googleEmail?: string;
  cloudId?: string;
  cloudEnabled?: boolean;
}
class ProfileRegistry extends Dexie {
  profiles!: Table<Profile, string>;
  constructor() {
    super("clara-profiles");
    this.version(1).stores({ profiles: "id,googleUid" });
    this.version(2).stores({ profiles: "id,googleUid,created" });
  }
}
export const registry = new ProfileRegistry();
// Immutable for this document. Each tab owns its selection; switching reloads
// the document so in-flight work can never be redirected to another database.
export const sessionProfileId =
  typeof sessionStorage === "undefined"
    ? null
    : sessionStorage.getItem("clara-active-profile");
export const profileDatabaseName = (id: string) =>
  id === "legacy" ? "crystal-finanzas" : `clara-profile-${id}`;
export const activeProfile = async (): Promise<Profile | undefined> =>
  sessionProfileId ? await registry.profiles.get(sessionProfileId) : undefined;

export function cloudScope(
  profile: Profile | undefined,
  uid: string | undefined,
) {
  if (
    !profile?.cloudEnabled ||
    !uid ||
    profile.googleUid !== uid ||
    !profile.cloudId
  )
    return null;
  return { uid, profileId: profile.cloudId };
}

export async function initializeProfiles() {
  // Preserve the original database in place. Ownership of historical mixed
  // data is unknown, so it is NEVER silently attached to a Google account.
  if (await Dexie.exists("crystal-finanzas")) {
    await registry.transaction("rw", registry.profiles, async () => {
      if (!(await registry.profiles.get("legacy"))) {
        await registry.profiles.add({
          id: "legacy",
          name: "Mis datos anteriores",
          created: Date.now(),
        });
      }
    });
  }
}
export async function createProfile(name: string): Promise<Profile> {
  const clean = name.trim();
  if (!clean || clean.length > 40)
    throw new Error("Escribe un nombre de 1 a 40 caracteres.");
  const profile = { id: crypto.randomUUID(), name: clean, created: Date.now() };
  await registry.profiles.add(profile);
  return profile;
}
export async function openProfile(id: string) {
  if (!(await registry.profiles.get(id)))
    throw new Error("No se encontró el perfil.");
  sessionStorage.setItem("clara-active-profile", id);
  window.location.reload();
}
export function chooseProfile() {
  sessionStorage.removeItem("clara-active-profile");
  window.location.reload();
}
export async function linkProfile(uid: string, email: string | null) {
  await registry.transaction("rw", registry.profiles, async () => {
    const profile = await activeProfile();
    if (!profile) throw new Error("Selecciona un perfil primero.");
    if (profile.googleUid && profile.googleUid !== uid)
      throw new Error(
        `Este perfil está vinculado a ${profile.googleEmail || "otra cuenta"}. Usa esa cuenta o crea un perfil nuevo.`,
      );
    await registry.profiles.update(profile.id, {
      googleUid: uid,
      googleEmail: email || "Cuenta Google",
      cloudId: profile.cloudId || profile.id,
      cloudEnabled: true,
    });
  });
}
export async function renameProfile(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean || clean.length > 40)
    throw new Error("Escribe un nombre de 1 a 40 caracteres.");
  if (!(await registry.profiles.get(id)))
    throw new Error("No se encontró el perfil.");
  await registry.profiles.update(id, { name: clean });
}
export async function deleteProfile(id: string): Promise<void> {
  if (!(await registry.profiles.get(id)))
    throw new Error("No se encontró el perfil.");
  await registry.profiles.delete(id);
  const dbName = profileDatabaseName(id);
  try {
    await Dexie.delete(dbName);
  } catch {}
  if (
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem("clara-active-profile") === id
  ) {
    sessionStorage.removeItem("clara-active-profile");
  }
}
export async function pauseCloud() {
  if (sessionProfileId)
    await registry.profiles.update(sessionProfileId, { cloudEnabled: false });
}

