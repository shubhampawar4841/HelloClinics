import { supabase } from "../lib/supabase.js";

/**
 * Require valid Supabase JWT (e.g. from Google OAuth or email).
 * Sets req.user = { id } on success.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = { id: user.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
