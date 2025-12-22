import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { createClient } from "@supabase/supabase-js";

// Extend Request type to include userId
declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

/**
 * Admin Supabase client (lazy + non-fatal):
 * - Server should still boot even if admin env vars are missing.
 * - Only /api/account needs service role.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return supabaseAdmin;
}

/**
 * Verify the bearer token and attach the userId (using admin getUser).
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(501).json({
      message:
        "Account deletion is not configured on this server (missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).",
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  const token = authHeader.slice("Bearer ".length);

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  if (error || !user?.id) {
    return res.status(401).json({ message: "Unauthorized or invalid token" });
  }

  req.userId = user.id;
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  /**
   * DELETE /api/account
   * - Requires Supabase service role (server-only)
   * - Deletes user rows + auth user
   */
  app.delete("/api/account", requireAuth, async (req, res) => {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(501).json({
        message:
          "Account deletion is not configured on this server (missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "User context missing" });

    try {
      // Delete user data from tables
      const logs = await admin.from("pregnancy_logs").delete().eq("user_id", userId);
      if (logs.error) return res.status(500).json({ message: logs.error.message });

      const appts = await admin
        .from("pregnancy_appointments")
        .delete()
        .eq("user_id", userId);
      if (appts.error) return res.status(500).json({ message: appts.error.message });

      const profile = await admin
        .from("pregnancy_profiles")
        .delete()
        .eq("user_id", userId);
      if (profile.error) return res.status(500).json({ message: profile.error.message });

      // Delete the auth user (admin only)
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        return res.status(500).json({ message: deleteError.message });
      }

      return res.json({ message: "Account deleted successfully" });
    } catch (err) {
      console.error("Error deleting account:", err);
      return res.status(500).json({ message: "Failed to delete account" });
    }
  });

  return httpServer;
}
