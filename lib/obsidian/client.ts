const KEY_LS = "valleos-obsidian-key";
const PORT_LS = "valleos-obsidian-port";

function base() {
  const port = localStorage.getItem(PORT_LS) ?? "27124";
  return `https://127.0.0.1:${port}`;
}

export function getObsidianKey(): string {
  return localStorage.getItem(KEY_LS) ?? "";
}
export function setObsidianKey(key: string) {
  localStorage.setItem(KEY_LS, key);
}
export function getObsidianPort(): string {
  return localStorage.getItem(PORT_LS) ?? "27124";
}
export function setObsidianPort(port: string) {
  localStorage.setItem(PORT_LS, port);
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${getObsidianKey()}`, ...extra };
}

export async function testObsidian(): Promise<boolean> {
  try {
    const res = await fetch(`${base()}/`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type VaultEntry = {
  path: string;
  isDir: boolean;
};

export async function listVault(folder = ""): Promise<VaultEntry[]> {
  const apiPath = folder ? `${folder}/` : "";
  const res = await fetch(`${base()}/vault/${apiPath}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`List error ${res.status}`);
  const data = (await res.json()) as { files: string[] };
  return (data.files ?? []).map((f) => ({
    path: f.endsWith("/") ? f.slice(0, -1) : f,
    isDir: f.endsWith("/"),
  }));
}

export async function readNote(path: string): Promise<string> {
  const res = await fetch(`${base()}/vault/${path}`, {
    headers: authHeaders({ Accept: "text/markdown" }),
  });
  if (!res.ok) throw new Error(`Read error ${res.status}`);
  return res.text();
}

export async function writeNote(path: string, content: string): Promise<void> {
  const res = await fetch(`${base()}/vault/${path}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "text/markdown" }),
    body: content,
  });
  if (!res.ok) throw new Error(`Write error ${res.status}`);
}

export async function deleteNote(path: string): Promise<void> {
  const res = await fetch(`${base()}/vault/${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete error ${res.status}`);
}

export type SearchMatch = {
  filename: string;
  score: number;
  matches: Array<{ match: { start: number; end: number }; context: string }>;
};

export async function searchVault(query: string): Promise<SearchMatch[]> {
  const res = await fetch(`${base()}/search/simple/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ query, contextLength: 120 }),
  });
  if (!res.ok) throw new Error(`Search error ${res.status}`);
  return res.json();
}
