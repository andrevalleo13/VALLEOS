// Genera un nuevo refresh_token de Google Calendar con scope de escritura.
// Uso: node scripts/refresh-google-token.js
const { google } = require("googleapis");
const http = require("http");
const url = require("url");
const fs = require("fs");

const envRaw = fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .reduce((a, l) => {
    const [k, ...v] = l.split("=");
    a[k.trim()] = v.join("=").trim();
    return a;
  }, {});

const CLIENT_ID = envRaw.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = envRaw.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3333/callback";

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ],
});

console.log("\nAbre esta URL en tu navegador:\n");
console.log(authUrl);
console.log("\nEsperando callback en http://localhost:3333/callback …\n");

const server = http.createServer(async (req, res) => {
  const { query } = url.parse(req.url, true);
  if (!query.code) {
    res.end("Sin código. Intenta de nuevo.");
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(query.code);
    res.end("OK — revisa la terminal.");
    server.close();
    console.log("\n✅  Nuevo refresh_token obtenido:\n");
    console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log(
      "\nPega ese valor en .env.local reemplazando el anterior y reinicia el servidor.\n"
    );
  } catch (e) {
    res.end("Error: " + e.message);
    console.error(e);
    server.close();
  }
});

server.listen(3333);
