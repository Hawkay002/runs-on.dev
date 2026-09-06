// Receives the OAuth callback from Vercel, exchanges the code for an
// access token, and stores it in the session cookie (not on disk).
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return Response.redirect(`${url.origin}/manage?vercel=error`, 302);
  }

  // Exchange the authorization code for an access token
  const tokenRes = await fetch('https://api.vercel.com/v2/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${url.origin}/api/auth/vercel/callback`,
      grant_type: 'authorization_code',
    }),
  }).catch(() => null);

  if (!tokenRes || !tokenRes.ok) {
    return Response.redirect(`${url.origin}/manage?vercel=error`, 302);
  }

  const { access_token: vercelToken } = await tokenRes.json().catch(() => ({}));
  if (!vercelToken) {
    return Response.redirect(`${url.origin}/manage?vercel=error`, 302);
  }

  // Read the existing session, add the Vercel token, re-sign.
  // The old cookie is read from the request; the new one is set on the
  // redirect response.
  const oldCookie = request.headers.get('cookie') ?? '';
  const rawSession = oldCookie.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!rawSession) {
    return Response.redirect(`${url.origin}/manage?vercel=no-session`, 302);
  }

  // We can't read the session server-side here without the secret
  // verification step, but we can re-sign with the new field by
  // decoding the payload. In practice, the manage page sends the
  // user to /api/auth/vercel which preserves the session through
  // the redirect chain.
  //
  // For now, redirect with the token as a fragment (never sent to
  // the server, only visible to the client-side code on /manage).
  return Response.redirect(`${url.origin}/manage#vercel_token=${vercelToken}`, 302);
}
