export type Membership = {
  code: string;
  playerId: string;
  setId: string;
};

const KEY = "lezgo.membership";

export function readMembership(): Membership | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "") as Membership;
    if (!parsed.code || !parsed.playerId || !parsed.setId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMembership(membership: Membership): void {
  localStorage.setItem(KEY, JSON.stringify(membership));
}

export function clearMembership(): void {
  localStorage.removeItem(KEY);
}
