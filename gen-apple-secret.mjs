import fs from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

const TEAM_ID = "L7GQ6RN22C";
const KEY_ID = "K5YH7GF7FU";
const CLIENT_ID = "com.bumpplanner.app.web";

// reads the key from one level up: ../AuthKey_K5YH7GF7FU.p8
const p8PathUrl = new URL(`../AuthKey_${KEY_ID}.p8`, import.meta.url);
const privateKeyPem = fs.readFileSync(p8PathUrl, "utf8");

const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 180; // 180 days

const privateKey = await importPKCS8(privateKeyPem, "ES256");

const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
  .setIssuer(TEAM_ID)
  .setAudience("https://appleid.apple.com")
  .setSubject(CLIENT_ID)
  .setIssuedAt(now)
  .setExpirationTime(exp)
  .sign(privateKey);

console.log(jwt);

