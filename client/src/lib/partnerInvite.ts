// client/src/lib/partnerInvite.ts

/**
 * Generate a cryptographically secure random invite token
 * Returns a URL-safe base64 string (22 chars from 16 random bytes)
 */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Convert to base64 and make URL-safe
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64;
}

/**
 * Hash a token using SHA-256
 * This is what gets stored in the database
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Build the full invite URL for sharing
 * Always uses web URL (even on mobile) since partners accept via browser
 */
export function buildInviteUrl(token: string): string {
  // Always use production web URL for partner invites
  // Partners need to accept in a browser, not inside the native app
  const webOrigin = "https://bump-planner.onrender.com";
  return `${webOrigin}/join?token=${encodeURIComponent(token)}`;
}

/**
 * Extract token from URL search params
 */
export function getTokenFromUrl(searchString: string): string | null {
  const params = new URLSearchParams(searchString);
  return params.get('token');
}