import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function safeText(v: unknown, max = 4000) {
  if (v === null || v === undefined) return '';
  return String(v).trim().slice(0, max);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ct = request.headers.get('content-type') || '';

    let data: Record<string, unknown> = {};
    if (ct.includes('application/json')) {
      data = (await request.json()) || {};
    } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await request.formData();
      form.forEach((value, key) => {
        data[key] = value;
      });
    }

    // Minimal validation (keep flexible): must have name OR email, and message OR website.
    const payload = {
      id: `c_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      source: safeText(data.source, 120),
      page: safeText(data.page, 300),
      name: safeText(data.name || data.business, 160),
      email: safeText(data.email, 200),
      phone: safeText(data.phone, 80),
      service: safeText(data.service, 200),
      website: safeText(data.website, 500),
      areas: safeText(data.areas, 400),
      message: safeText(data.message || data.notes, 4000),
    };

    const hasIdentity = Boolean(payload.name) || Boolean(payload.email) || Boolean(payload.phone);
    const hasContent = Boolean(payload.message) || Boolean(payload.website);

    if (!hasIdentity || !hasContent) {
      return json({ ok: false, error: 'VALIDATION_ERROR', message: 'Please provide contact details and a message/website.' }, 400);
    }

    // Store locally (works in dev / Node deploy). For serverless, this may not persist.
    const storePath = path.join(process.cwd(), 'data', 'contacts.jsonl');
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.appendFileSync(storePath, JSON.stringify(payload) + '\n', 'utf8');

    return json({ ok: true, id: payload.id });
  } catch (err) {
    return json({ ok: false, error: 'SERVER_ERROR', message: String(err) }, 500);
  }
};
