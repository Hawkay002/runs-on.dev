// Sign out: clear the session cookie and send the browser back to the front
// page. POST rather than GET so a prefetching link or an eager crawler can
// never log someone out by accident; the manage panel's logout button calls
// this and then navigates itself.
export async function POST() {
  const headers = new Headers();
  // Same cookie name and flags the callback sets, with Max-Age=0 as the off
  // switch. Secure + HttpOnly stay: clearing must match the cookie it clears.
  headers.append('Set-Cookie', 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 204, headers });
}
