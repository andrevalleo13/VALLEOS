#!/usr/bin/env node
/**
 * Shadow Daemon — Valle OS local agent
 * Corre en tu Mac en localhost:3999
 * Inicia: node daemon/shadow-daemon.js
 * Auto-start: launchctl load ~/Library/LaunchAgents/com.valleos.shadow.plist
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, exec } = require("child_process");

const PORT = 3999;
const HOST = "127.0.0.1";
const TOKEN = process.env.SHADOW_DAEMON_KEY || "valleos-shadow-daemon";
const HOME = os.homedir();

function expandPath(p) {
  if (!p) return null;
  return String(p).replace(/^~/, HOME);
}

function escapeShellArg(s) {
  return String(s ?? "").replace(/'/g, "'\\''");
}

function escapeAppleScript(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function handleAction(data) {
  const action = data.action;

  switch (action) {
    case "open_app": {
      if (!data.app) return { ok: false, error: "Falta el nombre de la app" };
      exec(`open -a '${escapeShellArg(data.app)}'`);
      return { ok: true, result: `Abriendo ${data.app}` };
    }

    case "open_url": {
      if (!data.url) return { ok: false, error: "Falta la URL" };
      const u = String(data.url);
      if (!/^https?:\/\//.test(u)) return { ok: false, error: "URL inválida" };
      exec(`open '${escapeShellArg(u)}'`);
      return { ok: true, result: `Abriendo ${u}` };
    }

    case "read_file": {
      const p = expandPath(data.path);
      if (!p) return { ok: false, error: "Falta la ruta" };
      try {
        const content = fs.readFileSync(p, "utf8");
        return { ok: true, result: content.slice(0, 12000) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case "write_file": {
      const p = expandPath(data.path);
      const content = data.content ?? "";
      if (!p) return { ok: false, error: "Falta la ruta" };
      try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content, "utf8");
        return { ok: true, result: `Guardado: ${data.path}` };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case "delete_file": {
      const p = expandPath(data.path);
      if (!p) return { ok: false, error: "Falta la ruta" };
      try {
        fs.unlinkSync(p);
        return { ok: true, result: `Eliminado: ${data.path}` };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case "list_dir": {
      const p = expandPath(data.path || "~");
      try {
        const entries = fs.readdirSync(p, { withFileTypes: true });
        const lines = entries.map((e) => (e.isDirectory() ? `[dir] ${e.name}` : e.name));
        return { ok: true, result: lines.join("\n") };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case "run_shell": {
      if (!data.cmd) return { ok: false, error: "Falta el comando" };
      try {
        const out = execSync(String(data.cmd), {
          timeout: 20000,
          env: { ...process.env, HOME },
          cwd: HOME,
        }).toString();
        return { ok: true, result: out.slice(0, 6000) };
      } catch (e) {
        return { ok: false, error: e.message?.slice(0, 500) ?? "Error" };
      }
    }

    case "notify_mac": {
      const title = escapeAppleScript(data.title || "Shadow");
      const body = escapeAppleScript(data.body || "");
      exec(`osascript -e 'display notification "${body}" with title "${title}"'`);
      return { ok: true, result: "Notificación enviada" };
    }

    case "get_context": {
      try {
        const app = execSync(
          `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
          { timeout: 3000 }
        ).toString().trim();
        let clip = "";
        try { clip = execSync("pbpaste", { timeout: 2000 }).toString().trim().slice(0, 800); } catch {}
        return { ok: true, result: `App activa: ${app}${clip ? `\nPortapapeles: ${clip}` : ""}` };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    default:
      return { ok: false, error: `Acción desconocida: ${action}` };
  }
}

const server = http.createServer((req, res) => {
  // CORS — allow local origins
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Auth
  const auth = req.headers["authorization"] ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (provided !== TOKEN) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/ping") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, result: "Shadow daemon activo" }));
    return;
  }

  // Action endpoint
  if (req.method === "POST" && req.url === "/action") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const result = handleAction(data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "JSON inválido" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`Shadow daemon corriendo en http://${HOST}:${PORT}`);
  console.log(`Token: ${TOKEN}`);
});
