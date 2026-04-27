interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  // Set in Cloudflare Pages → Settings → Environment Variables.
  // Test/dummy keys (1x0000…, 2x0000…, 3x0000…) cause verification to be skipped
  // so deploys don't break before real keys are configured.
  TURNSTILE_SECRET_KEY?: string;
  // Resend API key for lead-notification emails. Sign up free at resend.com,
  // verify uxhm.co.uk, then set this in Pages env vars. If unset, leads still
  // save to D1 but no email is sent (logged as a warning).
  RESEND_API_KEY?: string;
  // Where lead notification emails are sent. Defaults to hello@uxhm.co.uk.
  LEAD_NOTIFICATION_EMAIL?: string;
  // The from address for lead emails. Must be on a Resend-verified domain.
  // Defaults to leads@uxhm.co.uk.
  LEAD_NOTIFICATION_FROM?: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const ALLOWED_ORIGINS = ['https://uxhm.co.uk', 'https://www.uxhm.co.uk'];

// In-memory rate limit. Note: this is per-isolate and resets on cold start, so
// it only catches trivial repeat hits within a single isolate. The real defence
// is a Cloudflare Rate Limiting Rule on the dashboard:
//   Pages → Settings → Functions → Rate Limiting → 10 req/min on /api/*
// This map is kept as a cheap belt-and-braces layer; don't rely on it alone.
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
  // Browsers always send Origin on cross-origin POSTs, so legitimate users
  // always have one. Missing Origin = curl / scripts / bots → reject.
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

// Cloudflare Turnstile dummy/test secret keys all start with these prefixes.
// When the configured secret matches a test key (or is missing), we skip
// verification so deploys don't break before real keys are configured.
// Source: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
function shouldEnforceTurnstile(secretKey: string | undefined): boolean {
  if (!secretKey) return false;
  if (secretKey.startsWith('1x0000000000000000000000000000000')) return false;
  if (secretKey.startsWith('2x0000000000000000000000000000000')) return false;
  if (secretKey.startsWith('3x0000000000000000000000000000000')) return false;
  return true;
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

    // --- /api/analyze (free website audit lead magnet) ---
    if (url.pathname === '/api/analyze') {
      if (request.method === 'POST') return handleAnalyze(request, env);
      return methodNotAllowed('/api/analyze');
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

// ── Turnstile Verification ──────────────────────────────────
async function verifyTurnstile(token: string, secretKey: string, remoteip?: string): Promise<boolean> {
  const body = new URLSearchParams();
  body.append('secret', secretKey);
  body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);

  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const result = await fetch(url, {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const outcome = (await result.json()) as { success: boolean; 'error-codes'?: string[] };

  if (!outcome.success) {
    // Log the error codes only — never log the secret or token contents.
    console.error('Turnstile verification failed:', JSON.stringify(outcome['error-codes'] ?? []));
  }

  return outcome.success;
}

// ── Lead Notification Email (Resend) ───────────────────────
type LeadKind = 'lead' | 'contact';

async function sendLeadNotification(
  env: Env,
  kind: LeadKind,
  data: Record<string, string>
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — lead saved to D1 but no email sent');
    return;
  }

  const to = env.LEAD_NOTIFICATION_EMAIL || 'hello@uxhm.co.uk';
  const fromAddr = env.LEAD_NOTIFICATION_FROM || 'leads@uxhm.co.uk';

  const subject =
    kind === 'lead'
      ? `New launch lead: ${data.name || 'unknown'} (${data.business_name || 'no business'})`
      : `New contact: ${data.name || 'unknown'} — ${data.service || 'general'}`;

  const rows = Object.entries(data)
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#666;font-size:13px;text-align:right;vertical-align:top"><b>${escapeHtml(
          k
        )}</b></td><td style="padding:6px 12px;font-size:14px">${escapeHtml(String(v))}</td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#00a79d;margin:0 0 16px;font-size:18px">New ${kind === 'lead' ? 'launch lead' : 'contact'} from uxhm.co.uk</h2>
      <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px;overflow:hidden">${rows}</table>
      <p style="color:#666;font-size:12px;margin-top:16px">
        Reply directly to this email to respond to the lead — reply-to is set to their address.
      </p>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `UXHM Leads <${fromAddr}>`,
        to: [to],
        reply_to: data.email || undefined,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend send failed:', res.status, errText);
    }
  } catch (err) {
    console.error('Resend exception:', err instanceof Error ? err.message : err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

    // Turnstile verification — enforced when a real (non-test) secret is configured.
    if (shouldEnforceTurnstile(env.TURNSTILE_SECRET_KEY)) {
      const token = fd.get('cf-turnstile-response') as string;
      if (!token || !(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY!, ip))) {
        return new Response(
          JSON.stringify({ ok: false, message: 'Verification failed. Please try again.' }),
          { status: 403, headers: JSON_HEADERS }
        );
      }
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

    // Send notification email — runs in the background; never blocks the response
    // and never causes the form to fail if Resend is down or unconfigured.
    await sendLeadNotification(env, 'lead', {
      name,
      email,
      business_name: businessName,
      industry,
      domain_preference: domainPreference,
      message,
      source,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Submit application error:', err instanceof Error ? err.stack || err.message : err);
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

    // Turnstile verification — enforced when a real (non-test) secret is configured.
    if (shouldEnforceTurnstile(env.TURNSTILE_SECRET_KEY)) {
      const token = fd.get('cf-turnstile-response') as string;
      if (!token || !(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY!, ip))) {
        return new Response(
          JSON.stringify({ ok: false, message: 'Verification failed. Please try again.' }),
          { status: 403, headers: JSON_HEADERS }
        );
      }
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

    // Notify Hira so leads don't sit in D1 unnoticed.
    await sendLeadNotification(env, 'contact', {
      name,
      email,
      service,
      message,
      source,
      page,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Contact form error:', err instanceof Error ? err.stack || err.message : err);
    return new Response(JSON.stringify({ ok: false, message: 'Internal Server Error' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}

// ── Free website audit lead magnet ────────────────────────
async function handleAnalyze(request: Request, env: Env): Promise<Response> {
  try {
    if (!isOriginAllowed(request)) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: JSON_HEADERS });
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ ok: false, error: 'Too many requests. Try again in a minute.' }), { status: 429, headers: JSON_HEADERS });
    }

    let body: { url?: unknown; email?: unknown };
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { status: 400, headers: JSON_HEADERS }); }

    let urlStr = String(body.url ?? '').trim();
    if (!urlStr) return new Response(JSON.stringify({ ok: false, error: 'Please provide a website URL.' }), { status: 400, headers: JSON_HEADERS });
    if (!/^https?:\/\//i.test(urlStr)) urlStr = 'https://' + urlStr;
    let target: URL;
    try { target = new URL(urlStr); } catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid URL.' }), { status: 400, headers: JSON_HEADERS }); }
    if (!['http:', 'https:'].includes(target.protocol)) return new Response(JSON.stringify({ ok: false, error: 'Invalid URL protocol.' }), { status: 400, headers: JSON_HEADERS });

    const email = String(body.email ?? '').trim();
    if (!isValidEmail(email)) return new Response(JSON.stringify({ ok: false, error: 'Please provide a valid email.' }), { status: 400, headers: JSON_HEADERS });

    const url = target.toString();
    const psiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(url) + '&strategy=mobile&category=performance&category=best-practices&category=seo&category=accessibility';

    let lhResult: { categories?: Record<string, { score?: number }>; audits?: Record<string, { numericValue?: number }> } | null = null;
    try {
      const psi = await fetch(psiUrl);
      const psiJson = await psi.json() as { lighthouseResult?: typeof lhResult };
      lhResult = psiJson?.lighthouseResult ?? null;
    } catch (err) {
      console.warn('PageSpeed fetch failed:', err instanceof Error ? err.message : err);
    }

    const cats = lhResult?.categories ?? {};
    const perf = cats.performance?.score;
    const bp = cats['best-practices']?.score;
    const seo = cats.seo?.score;
    const a11y = cats.accessibility?.score;

    const issues: string[] = [];
    const wins: string[] = [];
    if (typeof perf === 'number' && perf < 0.5) { issues.push('Slow mobile performance'); wins.push('Compress images, defer heavy scripts, fix layout shifts.'); }
    if (typeof seo === 'number' && seo < 0.8) { issues.push('Weak on-page SEO basics'); wins.push('Add titles, meta description, headings, and internal links.'); }
    if (typeof bp === 'number' && bp < 0.8) { issues.push('Best-practices issues'); wins.push('Fix HTTPS, console errors, modern image formats.'); }
    if (typeof a11y === 'number' && a11y < 0.8) { issues.push('Accessibility issues'); wins.push('Fix colour contrast, alt text, and ARIA labels.'); }
    const audits = lhResult?.audits ?? {};
    const lcp = audits['largest-contentful-paint']?.numericValue;
    if (typeof lcp === 'number' && lcp > 4000) { issues.push('Slow largest contentful paint'); wins.push('Optimise hero image, preload key assets.'); }

    const vals = [perf, bp, seo, a11y].filter((v): v is number => typeof v === 'number');
    const score = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) : null;

    const results = {
      ok: true,
      input: { url, email },
      score,
      issues: issues.slice(0, 12),
      quickWins: wins.slice(0, 10),
      pagespeed: { ok: !!lhResult, lighthouse: lhResult ? { categories: { performance: perf, bestPractices: bp, seo, accessibility: a11y }, audits } : null },
    };

    await sendLeadNotification(env, 'contact', {
      name: 'Audit Tool Lead',
      email,
      service: 'Free Website Audit',
      message: 'Audited ' + url + ' — overall score ' + (score ?? 'n/a') + '/100.\n\nTop issues:\n' + issues.slice(0, 5).map((i) => '- ' + i).join('\n'),
      source: 'audit_tool',
      page: '/audit',
    });

    return new Response(JSON.stringify(results), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Analyze error:', err instanceof Error ? err.stack || err.message : err);
    return new Response(JSON.stringify({ ok: false, error: 'Audit failed. Please try again.' }), { status: 500, headers: JSON_HEADERS });
  }
}
