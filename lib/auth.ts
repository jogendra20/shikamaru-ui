export async function token() {
  const d = new TextEncoder().encode(
    `${process.env.NEXUS_PASSWORD}:${process.env.AUTH_SECRET}`
  );
  const h = await crypto.subtle.digest("SHA-256", d);
  return Array.from(new Uint8Array(h))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
