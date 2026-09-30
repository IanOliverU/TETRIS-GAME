// Room codes like A7K92 — unambiguous charset (no 0/O, 1/I).
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5): string {
  let out = "";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) out += CHARSET[buf[i] % CHARSET.length];
  return out;
}

export function normalizeRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "Q")
    .replace(/0/g, "Q")
    .replace(/1/g, "7")
    .replace(/I/g, "J")
    .slice(0, 8);
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z2-9]{4,8}$/.test(code);
}

export function inviteLink(code: string): string {
  if (typeof window === "undefined") return `/game/${code}`;
  return `${window.location.origin}/game/${code}`;
}
