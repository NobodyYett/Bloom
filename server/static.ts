// server/static.ts
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Manually define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Apple App Site Association for Universal Links
// This allows iOS to verify your app owns this domain
const appleAppSiteAssociation = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "L7GQ6RN22C.com.bumpplanner.app",
        paths: ["/auth/callback", "/auth/*", "/*"],
      },
    ],
  },
  webcredentials: {
    apps: ["L7GQ6RN22C.com.bumpplanner.app"],
  },
};

export function serveStatic(app: Express) {
  // dist/public from project root
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  const indexHtml = path.join(distPath, "index.html");

  if (!fs.existsSync(indexHtml)) {
    throw new Error(
      `Could not find the build output: ${indexHtml}\n` +
        `distPath: ${distPath}\n` +
        `__dirname: ${__dirname}\n` +
        `Did Render run: npm run build:web ?`,
    );
  }

  // ✅ Apple App Site Association - MUST be served before other routes
  // This file tells iOS that your app is allowed to handle links from this domain
  app.get("/.well-known/apple-app-site-association", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(appleAppSiteAssociation);
  });

  // Also serve at root for older iOS versions
  app.get("/apple-app-site-association", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(appleAppSiteAssociation);
  });

  // Serve static assets FIRST
  app.use(
    express.static(distPath, {
      index: false, // do not auto-serve index.html
      maxAge: "1y",
      immutable: true,
    }),
  );

  // SPA fallback (but NEVER hijack /api or /assets or /.well-known)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/assets")) return next();
    if (req.path.startsWith("/.well-known")) return next();
    res.sendFile(indexHtml);
  });
}