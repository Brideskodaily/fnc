// FNC Zápasníci – API pre Vercel (Node.js serverless function)
//
// GET    /api/fighters                 -> { fighters, storage, editable }
// POST   /api/fighters?action=login    -> overí heslo (hlavička x-admin-key)
// PUT    /api/fighters   { fighter }   -> uloží / vytvorí zápasníka
// DELETE /api/fighters?id=<id>         -> zmaže zápasníka
//
// Dáta sú v Upstash Redis (Vercel Marketplace) ako hash "fnc:fighters" (id -> JSON).
// Pri prvom spustení s prázdnym úložiskom sa automaticky nahrá data/fighters.json.

import { Redis } from "@upstash/redis";
import { createRequire } from "node:module";
import { createHash, timingSafeEqual } from "node:crypto";

const require = createRequire(import.meta.url);
const seedFile = require("../data/fighters.json");

const KEY = "fnc:fighters";
const SEEDED = "fnc:seeded";
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const ADMIN = process.env.ADMIN_PASSWORD || "";

const RESULTS = new Set(["W", "L", "D", "P"]);
const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

function str(v, max) {
  return String(v == null ? "" : v).trim().slice(0, max);
}

function clean(input) {
  if (!input || typeof input !== "object") return null;
  const id = str(input.id, 60);
  if (!ID_RE.test(id)) return null;
  const name = str(input.name, 60);
  if (!name) return null;
  const fights = (Array.isArray(input.fights) ? input.fights : [])
    .slice(0, 300)
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      id: str(x.id, 20) || Math.random().toString(36).slice(2, 9),
      event: Math.min(999, Math.max(1, parseInt(x.event, 10) || 1)),
      opponent: str(x.opponent, 80),
      result: RESULTS.has(x.result) ? x.result : "P",
      note: str(x.note, 120),
    }))
    .filter((x) => x.opponent);
  const aliases = (Array.isArray(input.aliases) ? input.aliases : [])
    .map((a) => str(a, 60))
    .filter(Boolean)
    .slice(0, 10);
  return {
    id,
    name,
    order: Number(input.order) || 999,
    aliases,
    fights,
    createdAt: Number(input.createdAt) || Date.now(),
    updatedAt: Date.now(),
  };
}

function authorized(req) {
  if (!ADMIN) return false;
  const given = String(req.headers["x-admin-key"] || "");
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(ADMIN).digest();
  return timingSafeEqual(a, b);
}

async function readAll() {
  if (!redis) return seedFile.fighters;
  let all = await redis.hgetall(KEY);
  if ((!all || Object.keys(all).length === 0) && !(await redis.get(SEEDED))) {
    // prvé spustenie: nahrá úvodné dáta z data/fighters.json (len raz)
    const seed = Object.fromEntries(seedFile.fighters.map((f) => [f.id, f]));
    await redis.hset(KEY, seed);
    await redis.set(SEEDED, "1");
    all = seed;
  }
  if (!all) return [];
  return Object.values(all).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const send = (code, body) => res.status(code).json(body);

  try {
    if (req.method === "GET") {
      return send(200, { fighters: await readAll(), storage: Boolean(redis), editable: Boolean(ADMIN) });
    }

    if (req.method === "POST" && req.query.action === "login") {
      if (!ADMIN) return send(403, { error: "Úpravy sú vypnuté (chýba ADMIN_PASSWORD)." });
      return authorized(req) ? send(200, { ok: true }) : send(401, { error: "Nesprávne heslo." });
    }

    if (req.method === "PUT" || req.method === "DELETE") {
      if (!authorized(req)) return send(401, { error: "Nesprávne heslo." });
      if (!redis) return send(503, { error: "Úložisko nie je pripojené." });
      await readAll(); // zabezpečí, že úložisko je naplnené

      if (req.method === "PUT") {
        const body = await readBody(req);
        const fighter = clean(body && body.fighter);
        if (!fighter) return send(400, { error: "Neplatné dáta zápasníka." });
        await redis.hset(KEY, { [fighter.id]: fighter });
      } else {
        const id = str(req.query.id, 60);
        if (!ID_RE.test(id)) return send(400, { error: "Neplatné id." });
        await redis.hdel(KEY, id);
      }
      return send(200, { ok: true, fighters: await readAll() });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return send(405, { error: "Nepodporovaná metóda." });
  } catch (err) {
    console.error(err);
    return send(500, { error: "Chyba servera." });
  }
}
