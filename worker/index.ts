interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TURNSTILE_SECRET_KEY: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function methodNotAllowed(endpoint: string) {
  return new Response(
    JSON.stringify({ ok: false, message: `Method Not Allowed. ${endpoint} only accepts POST requests.` }),
    { status: 405, headers: JSON_HEADERS }
  );
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
// Return type changed to include error codes
async function verifyTurnstile(token: string, ip: string, secretKey: string): Promise<{ success: boolean, errorCodes?: string[] }> {
  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);
  formData.append('remoteip', ip);

  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const result = await fetch(url, {
    body: formData,
    method: 'POST',
  });

  const outcome = await result.json() as { success: boolean, 'error-codes'?: string[] };
  // Log the raw outcome for maximum visibility
  console.log('Turnstile Outcome:', JSON.stringify(outcome));
  return { success: outcome.success, errorCodes: outcome['error-codes'] };
}

// ── Portfolio launch leads ──────────────────────────────────
async function handleSubmitApplication(request: Request, env: Env): Promise<Response> {
  try {
    const fd = await request.formData();
    // Turnstile check
    const token = fd.get('cf-turnstile-response') as string;
    const ip = request.headers.get('CF-Connecting-IP') as string;
    if (!await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY)) {
       const availableKeys = Object.keys(env).join(', ');
       const debugMsg = `Turnstile failed. Token: ${token ? 'OK' : 'MISSING'}, Secret: ${env.TURNSTILE_SECRET_KEY ? 'OK' : 'MISSING'}, IP: ${ip}, EnvKeys: [${availableKeys}]`;
       console.error(debugMsg);
       return new Response(JSON.stringify({ ok: false, message: debugMsg }), {
         status: 403, headers: JSON_HEADERS,
       });
    }

    const name = fd.get('name') as string;
    const email = fd.get('email') as string;
    const businessName = fd.get('business_name') as string;
    const industry = fd.get('industry') as string;
    const domainPreference = fd.get('domain_preference') as string;
    const message = fd.get('message') as string;
    const source = fd.get('source') as string;

    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, message: 'Name and Email are required' }), {
        status: 400, headers: JSON_HEADERS,
      });
    }

    const result = await env.DB.prepare(
      `INSERT INTO leads (name, email, business_name, industry, domain_preference, message, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(name, email, businessName, industry, domainPreference, message, source).run();

    if (!result.success) throw new Error('Database insert failed');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, message: 'Internal Server Error' }), {
      status: 500, headers: JSON_HEADERS,
    });
  }
}

// ── General contact form ────────────────────────────────────
async function handleContact(request: Request, env: Env): Promise<Response> {
  try {
    const fd = await request.formData();
    // Turnstile check
    const token = fd.get('cf-turnstile-response') as string;
    const ip = request.headers.get('CF-Connecting-IP') as string;
    if (!await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY)) {
       const availableKeys = Object.keys(env).join(', ');
       const debugMsg = `Turnstile failed. Token: ${token ? 'OK' : 'MISSING'}, Secret: ${env.TURNSTILE_SECRET_KEY ? 'OK' : 'MISSING'}, IP: ${ip}, EnvKeys: [${availableKeys}]`;
       console.error(debugMsg);
       return new Response(JSON.stringify({ ok: false, message: debugMsg }), {
         status: 403, headers: JSON_HEADERS,
       });
    }

    const name = fd.get('name') as string;
    const email = fd.get('email') as string;
    const service = fd.get('service') as string;
    const message = fd.get('message') as string;
    const source = fd.get('source') as string;
    const page = fd.get('page') as string;

    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, message: 'Name and Email are required' }), {
        status: 400, headers: JSON_HEADERS,
      });
    }

    const result = await env.DB.prepare(
      `INSERT INTO contacts (name, email, service, message, source, page, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(name, email, service, message, source, page).run();

    if (!result.success) throw new Error('Database insert failed');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, message: 'Internal Server Error' }), {
      status: 500, headers: JSON_HEADERS,
    });
  }
}
