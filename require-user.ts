import { auth } from "./auth";

/** Returns the current session user, or null if unauthenticated (caller returns 401). */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
