interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TURNSTILE_SECRET_KEY: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const ALLOWED_ORIGINS = ['https://uxhm.co.uk', 'https://www.uxhm.co.uk'];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function methodNotAllowed(endpoint: string) {
  return new Response(
    JSON.stringify({ ok: false, message: `Method Not Allowed. ${endpoint} only accepts POST requests.` }),
    { status: 405, headers: JSON_HEADERS }
  );
}

function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(value: string | null, maxLength = 500): string {
  if (!value) return '';
  return value.trim().slice(0, maxLength);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- /api/submit-application (portfolio launch leads) ---
    if (url.pathname === '/api/submit-application') {
      if (request.method === 'POST') return handleSubmitApplication(request, env);
      return methodNotAllowed('/api/submit-application');
    }

    // --- /api/contact (general contact form) ---
    if (url.pathname === '/api/contact') {
      if (request.method === 'POST') return handleContact(request, env);
      return methodNotAllowed('/api/contact');
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

// ── Turnstile Verification ──────────────────────────────────
async function verifyTurnstile(token: string, ip: string, secretKey: string): Promise<boolean> {
  console.log('Turnstile debug - token first 20 chars:', token?.substring(0, 20), 'token length:', token?.length, 'secret first 10:', secretKey?.substring(0, 10));

  const body = JSON.stringify({
    secret: secretKey,
    response: token,
    remoteip: ip,
  });

  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const result = await fetch(url, {
    body: body,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const outcome = (await result.json()) as { success: boolean; 'error-codes'?: string[] };
  console.log('Turnstile response:', JSON.stringify(outcome));

  if (!outcome.success) {
    console.error('Turnstile verification failed:', outcome['error-codes']);
  }

  return outcome.success;
}

// ── Portfolio launch leads ──────────────────────────────────
async function handleSubmitApplication(request: Request, env: Env): Promise<Response> {
  try {
    if (!isOriginAllowed(request)) {
      return new Response(JSON.stringify({ ok: false, message: 'Forbidden' }), {
        status: 403,
        headers: JSON_HEADERS,
      });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ ok: false, message: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: JSON_HEADERS,
      });
    }

    const fd = await request.formData();

    const token = fd.get('cf-turnstile-response') as string;
    if (!token || !(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY))) {
      return new Response(JSON.stringify({ ok: false, message: 'Verification failed. Please try again.' }), {
        status: 403,
        headers: JSON_HEADERS,
      });
    }

    const name = sanitize(fd.get('name') as string, 200);
    const email = sanitize(fd.get('email') as string, 254);
    const businessName = sanitize(fd.get('business_name') as string, 200);
    const industry = sanitize(fd.get('industry') as string, 100);
    const domainPreference = sanitize(fd.get('domain_preference') as string, 200);
    const message = sanitize(fd.get('message') as string, 2000);
    const source = sanitize(fd.get('source') as string, 50);

    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, message: 'Name and Email are required' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ ok: false, message: 'Please provide a valid email address' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const result = await env.DB.prepare(
      `INSERT INTO leads (name, email, business_name, industry, domain_preference, message, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(name, email, businessName, industry, domainPreference, message, source)
      .run();

    if (!result.success) throw new Error('Database insert failed');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Submit application error:', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ ok: false, message: 'Internal Server Error' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}

// ── General contact form ────────────────────────────────────
async function handleContact(request: Request, env: Env): Promise<Response> {
  try {
    if (!isOriginAllowed(request)) {
      return new Response(JSON.stringify({ ok: false, message: 'Forbidden' }), {
        status: 403,
        headers: JSON_HEADERS,
      });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ ok: false, message: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: JSON_HEADERS,
      });
    }

    const fd = await request.formData();

    const token = fd.get('cf-turnstile-response') as string;
    if (!token || !(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY))) {
      return new Response(JSON.stringify({ ok: false, message: 'Verification failed. Please try again.' }), {
        status: 403,
        headers: JSON_HEADERS,
      });
    }

    const name = sanitize(fd.get('name') as string, 200);
    const email = sanitize(fd.get('email') as string, 254);
    const service = sanitize(fd.get('service') as string, 100);
    const message = sanitize(fd.get('message') as string, 2000);
    const source = sanitize(fd.get('source') as string, 50);
    const page = sanitize(fd.get('page') as string, 200);

    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, message: 'Name and Email are required' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ ok: false, message: 'Please provide a valid email address' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const result = await env.DB.prepare(
      `INSERT INTO contacts (name, email, service, message, source, page, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(name, email, service, message, source, page)
      .run();

    if (!result.success) throw new Error('Database insert failed');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Contact form error:', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ ok: false, message: 'Internal Server Error' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
