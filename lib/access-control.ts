/**
 * Access control helpers for sensitive endpoints
 * Whitelist-based authorization for analytics/eval endpoints
 */

// Whitelist: Only these users can access full analytics/eval metrics
const ADMIN_WHITELIST = {
  userIds: ["hsbWIqZTUF9jbfOYwW7wtFwLBIL5Lnnu", "oVQYUTPfYneCn4uFrEcZQmC1YOyMd90w"],
  emails: ["realmonster2004@gmail.com", "giangnguyeen1910@gmail.com"],
};

/**
 * Check if user has admin access to view all metrics/evaluations
 * @param session - User session from auth
 * @returns true if user is whitelisted, false otherwise
 */
export function isMetricsAdmin(session: { user?: { id?: string; email?: string } } | null): boolean {
  if (!session?.user) {
    return false;
  }

  const userId = session.user.id;
  const email = session.user.email;

  // Check by user ID
  if (userId && ADMIN_WHITELIST.userIds.includes(userId)) {
    return true;
  }

  // Check by email
  if (email && ADMIN_WHITELIST.emails.includes(email)) {
    return true;
  }

  return false;
}

/**
 * Throw error if user is not authorized
 * @param session - User session
 * @throws Error if not authorized
 */
export function requireMetricsAdmin(session: { user?: { id?: string; email?: string } } | null): void {
  if (!isMetricsAdmin(session)) {
    throw new Error("Unauthorized: Only authorized admins can access this endpoint");
  }
}
