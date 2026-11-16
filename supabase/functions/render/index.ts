// Stylup : rendu coupe + couleur sur la photo de la cliente avec Nano Banana 2 (Gemini 3.1 Flash Image).
// La clé Gemini reste ici, dans les secrets Supabase : elle n'est jamais dans l'app ni sur GitHub.
//
// Secrets à définir dans Supabase (Edge Functions → Secrets) :
//   GEMINI_API_KEY     (obligatoire) clé créée dans Google AI Studio
//   GEMINI_MODEL       (facultatif)  par défaut « gemini-3.1-flash-image »
//   RENDER_ENABLED     (facultatif)  « false » coupe instantanément tous les rendus (interrupteur d'urgence)
//   DAILY_LIMIT        (facultatif)  rendus par jour, tous comptes confondus — 20 par défaut
//   MONTHLY_LIMIT      (facultatif)  rendus par mois, tous comptes confondus — 300 par défaut
//   USER_DAILY_LIMIT   (facultatif)  rendus par jour et par compte — 10 par défaut
//   USER_MINUTE_LIMIT  (facultatif)  rendus par minute et par compte — 3 par défaut
// Garde-fous : seul un compte connecté peut lancer un rendu ; chaque rendu est réservé en base AVANT l'appel
// à Gemini (plafonds vérifiés sous verrou) ; un rendu en échec ne compte pas.
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.1-flash-image";
const GEMINI_BASE = Deno.env.get("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com";
const num = (k: string, d: number) => { const v = Number(Deno.env.get(k)); return Number.isFinite(v) && v >= 0 ? v : d; };
const LIMITS = {
  user_minute: num("USER_MINUTE_LIMIT", 3), user_day: num("USER_DAILY_LIMIT", 10),
  global_day: num("DAILY_LIMIT", 20), global_month: num("MONTHLY_LIMIT", 300),
};
const ENABLED = (Deno.env.get("RENDER_ENABLED") || "true").toLowerCase() !== "false";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const MAX_IMAGE_B64 = 3_000_000; // ~2,2 Mo d'image
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

type CutItem = { field: string; name: string; desc?: string };
type Body = {
  image: string;
  cut?: { set: "f" | "h"; items: CutItem[] } | null;
  color?: { tone: number; toneName: string; reflet: number; refletName: string; code: string; custom?: string | null } | null;
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Texte libre venant de l'app : on le borne et on retire ce qui pourrait casser la consigne
const clean = (s: unknown, max = 120) => String(s ?? "").replace(/[\u0000-\u001f"<>{}]/g, " ").trim().slice(0, max);

const FIELD = { length: "Length", shape: "Cut", fringe: "Fringe", sides: "Sides", top: "Top", style: "Style" } as Record<string, string>;

function buildPrompt(b: Body): string {
  const lines = [
    "Edit this photo of a hair salon client to preview the requested hair service.",
    "Change ONLY the hair. Keep the person's face, identity, skin, expression, eyes, makeup, ears, neck, clothing, background, lighting, framing and camera angle exactly the same.",
    "The result must look like a real photo taken right after the appointment: photorealistic, natural hair texture and individual strands, realistic hairline and shine, no wig look, no retouching of the face.",
  ];
  if (b.cut && b.cut.items?.length) {
    lines.push(`Haircut (${b.cut.set === "h" ? "men's" : "women's"}):`);
    for (const it of b.cut.items.slice(0, 6)) {
      const label = FIELD[it.field] || "Detail";
      lines.push(`- ${label}: ${clean(it.name)}${it.desc ? ` (${clean(it.desc, 160)})` : ""}`);
    }
    lines.push("Shape the cut realistically for this person's hair type and head shape, as a skilled stylist would.");
  } else {
    lines.push("Keep the current haircut, length and styling unchanged.");
  }
  if (b.color) {
    const c = b.color;
    lines.push(
      `Hair colour: professional colourist shade ${clean(c.code, 8)} — level ${Number(c.tone)}/10 (${clean(c.toneName)})` +
        (Number(c.reflet) ? ` with a ${clean(c.refletName)} reflect` : ", natural (no reflect)") +
        (c.custom ? `, the salon calls it "${clean(c.custom)}"` : "") + ".",
      "Apply it as an even, salon-quality colour from root to tip with natural dimension; do not change the skin tone.",
    );
  } else {
    lines.push("Keep the current hair colour unchanged.");
  }
  lines.push("Do not add any text, logo or watermark. Return one image with the same aspect ratio as the input photo.");
  return lines.join("\n");
}

// Compte connecté à l'origine de la demande (la clé publique seule ne suffit pas)
async function currentUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || !SB_URL) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u.id : null;
  } catch { return null; }
}
async function rpc(name: string, args: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${name} ${r.status}`);
  return r.json();
}
const reserve = async (user: string) => (await rpc("stylup_reserve_render", {
  p_user: user, lim_user_minute: LIMITS.user_minute, lim_user_day: LIMITS.user_day, lim_global_day: LIMITS.global_day, lim_global_month: LIMITS.global_month,
}))[0];
const finish = (id: string, ok: boolean) => rpc("stylup_finish_render", { p_event: id, p_ok: ok }).catch(() => {});
const quota = async (user: string) => (await rpc("stylup_render_quota", {
  p_user: user, lim_user_day: LIMITS.user_day, lim_global_day: LIMITS.global_day, lim_global_month: LIMITS.global_month,
}))[0];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (req.method === "GET") {
    const user = await currentUser(req);
    const q = user ? await quota(user).catch(() => null) : null;
    return json(200, { ok: true, model: MODEL, configured: !!apiKey && ENABLED, enabled: ENABLED, quota: q });
  }
  if (req.method !== "POST") return json(405, { error: "method" });
  if (!ENABLED) return json(503, { error: "disabled" });
  if (!apiKey) return json(503, { error: "not_configured" });
  const user = await currentUser(req);
  if (!user) return json(401, { error: "auth_required" });

  let b: Body;
  try { b = await req.json(); } catch { return json(400, { error: "bad_json" }); }
  const data = String(b.image || "").replace(/^data:image\/\w+;base64,/, "");
  if (!data || data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return json(400, { error: "bad_image" });
  if (!b.cut && !b.color) return json(400, { error: "nothing_to_render" });
  // Réservation avant tout appel payant : si un plafond est atteint, Gemini n'est pas appelé
  let slot;
  try { slot = await reserve(user); } catch { return json(503, { error: "quota_unavailable" }); }
  if (!slot || !slot.ok) return json(429, { error: slot ? slot.reason : "quota_unavailable", quota: { user_left: slot?.user_left ?? 0, global_left: slot?.global_left ?? 0 } });
  const q = { user_left: slot.user_left, global_left: slot.global_left };
  const qFail = { user_left: slot.user_left + 1, global_left: slot.global_left + 1 }; // rendu raté = remboursé
  let success = false;

  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const r = await fetch(`${GEMINI_BASE}/v1/models/${MODEL}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(b) }, { inline_data: { mime_type: "image/jpeg", data } }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) return json(502, { error: "model_error", status: r.status, detail: out?.error?.message?.slice(0, 300), quota: qFail });
    // L'image finale est la dernière partie image qui n'est pas une étape de « réflexion »
    const parts = out?.candidates?.[0]?.content?.parts || [];
    const img = parts.filter((p: any) => !p.thought && (p.inlineData || p.inline_data)).pop();
    const blob = img && (img.inlineData || img.inline_data);
    if (!blob?.data) return json(502, { error: "no_image", reason: out?.candidates?.[0]?.finishReason || out?.promptFeedback?.blockReason || null, quota: qFail });
    success = true;
    return json(200, { image: `data:${blob.mimeType || blob.mime_type || "image/png"};base64,${blob.data}`, model: MODEL, quota: q });
  } catch (e) {
    return json(504, { error: ctrl.signal.aborted ? "timeout" : "network", detail: String(e).slice(0, 200), quota: qFail });
  } finally {
    clearTimeout(timer);
    await finish(slot.event_id, success); // un échec est remboursé
  }
});
