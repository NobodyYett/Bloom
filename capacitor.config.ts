import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bumpplanner.app",
  appName: "Bump Planner",
  webDir: "dist/public",
  server: {
    // For development, you can use your local server
    // url: "http://localhost:5000",
    // cleartext: true,
  },
  ios: {
    contentInset: "automatic",
    scheme: "com.bumpplanner.app",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Handle deep links for OAuth
    App: {
      allowExternalUrls: ["com.bumpplanner.app://"],
    },
  },
};

export default config;