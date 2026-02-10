// Cloudflare Pages Function: /api/analyze
// Receives { url, email } and returns audit signals.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function bad(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  // Add scheme if user typed example.com
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  return u.toString();
}

async function fetchJson(url, init) {
  const r = await fetch(url, init);
  const text = await r.text();
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {
    // ignore
  }
  return { ok: r.ok, status: r.status, text, json: j };
}

function computeQuickWins(pagespeed) {
  const wins = [];
  const lh = pagespeed?.lighthouse;
  const perf = lh?.categories?.performance;
  const seo = lh?.categories?.seo;

  if (typeof perf === 'number' && perf < 0.5) {
    wins.push('Improve mobile performance (compress images, remove heavy scripts, reduce layout shifts).');
  }
  if (typeof seo === 'number' && seo < 0.8) {
    wins.push('Improve on-page SEO basics (titles, meta description, headings, internal links).');
  }

  const audits = lh?.audits || {};
  const tbt = audits['total-blocking-time']?.numericValue;
  if (typeof tbt === 'number' && tbt > 300) wins.push('Reduce JavaScript blocking time (defer/async third-party scripts).');

  const lcp = audits['largest-contentful-paint']?.numericValue;
  if (typeof lcp === 'number' && lcp > 4000) wins.push('Reduce LCP (optimize hero image, preload key assets).');

  const cls = audits['cumulative-layout-shift']?.numericValue;
  if (typeof cls === 'number' && cls > 0.15) wins.push('Fix layout shift (set image dimensions, avoid late-loading banners).');

  return wins.slice(0, 8);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return bad('Invalid JSON body');
  }

  const url = normalizeUrl(body.url);
  const email = String(body.email || '').trim();

  if (!url) return bad('Please provide a valid website URL.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('Please provide a valid email.');

  const host = new URL(url).hostname;

  // 1) Google PageSpeed Insights (no key required for basic use)
  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=best-practices&category=seo&category=accessibility`;
  const psi = await fetchJson(psiUrl);

  // 2) SSL Labs (slow API; keep lightweight and best-effort)
  const sslUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(host)}&fromCache=on&all=done`;
  const ssl = await fetchJson(sslUrl);

  // 3) Meta tags scrape (best-effort)
  let meta = null;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'UXHM-AuditBot/1.0' } });
    const html = await r.text();
    const get = (re) => {
      const m = html.match(re);
      return m ? String(m[1] || '').trim() : null;
    };
    meta = {
      title: get(/<title[^>]*>([^<]{0,200})<\/title>/i),
      description: get(/<meta\s+name=["']description["']\s+content=["']([^"']{0,300})["'][^>]*>/i),
      ogTitle: get(/<meta\s+property=["']og:title["']\s+content=["']([^"']{0,200})["'][^>]*>/i),
      ogDescription: get(/<meta\s+property=["']og:description["']\s+content=["']([^"']{0,300})["'][^>]*>/i)
    };
  } catch {
    // ignore
  }

  const pagespeed = {
    ok: psi.ok,
    status: psi.status,
    lighthouse: psi.json?.lighthouseResult
      ? {
          categories: {
            performance: psi.json.lighthouseResult.categories?.performance?.score,
            bestPractices: psi.json.lighthouseResult.categories?.['best-practices']?.score,
            seo: psi.json.lighthouseResult.categories?.seo?.score,
            accessibility: psi.json.lighthouseResult.categories?.accessibility?.score
          },
          audits: psi.json.lighthouseResult.audits
        }
      : null
  };

  const results = {
    ok: true,
    input: { url, email },
    pagespeed,
    ssl: ssl.json || { ok: ssl.ok, status: ssl.status },
    meta,
    quickWins: computeQuickWins(pagespeed)
  };

  // Store lead (best-effort). Prefer KV binding named LEADS.
  try {
    if (env?.LEADS && typeof env.LEADS.put === 'function') {
      const key = `lead:${Date.now()}:${email.toLowerCase()}`;
      await env.LEADS.put(key, JSON.stringify({ url, email, createdAt: new Date().toISOString(), results }), {
        expirationTtl: 60 * 60 * 24 * 180 // 180 days
      });
    }
  } catch {
    // ignore
  }

  return json(results);
}

export async function onRequestOptions() {
  // Basic CORS for form POSTs (if needed)
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}
