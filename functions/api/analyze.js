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

function computeIssuesAndQuickWins(pagespeed, ssl, meta) {
  const issues = [];
  const wins = [];

  const lh = pagespeed?.lighthouse;
  const cats = lh?.categories || {};
  const audits = lh?.audits || {};

  const perf = cats?.performance;
  const seo = cats?.seo;
  const bp = cats?.bestPractices;

  if (typeof perf === 'number' && perf < 0.5) {
    issues.push('Slow mobile performance');
    wins.push('Improve mobile performance (compress images, remove heavy scripts, reduce layout shifts).');
  }
  if (typeof seo === 'number' && seo < 0.8) {
    issues.push('Weak on-page SEO basics');
    wins.push('Improve on-page SEO basics (titles, meta description, headings, internal links).');
  }
  if (typeof bp === 'number' && bp < 0.8) {
    issues.push('Best-practices issues');
    wins.push('Fix best-practices issues (HTTPS, console errors, modern image formats).');
  }

  const tbt = audits['total-blocking-time']?.numericValue;
  if (typeof tbt === 'number' && tbt > 300) {
    issues.push('JavaScript blocking time is high');
    wins.push('Reduce JavaScript blocking time (defer/async third-party scripts).');
  }

  const lcp = audits['largest-contentful-paint']?.numericValue;
  if (typeof lcp === 'number' && lcp > 4000) {
    issues.push('Largest Contentful Paint is slow');
    wins.push('Reduce LCP (optimize hero image, preload key assets).');
  }

  const cls = audits['cumulative-layout-shift']?.numericValue;
  if (typeof cls === 'number' && cls > 0.15) {
    issues.push('Layout shift issues');
    wins.push('Fix layout shift (set image dimensions, avoid late-loading banners).');
  }

  // SSL Labs (best-effort)
  const sslStatus = ssl?.json?.status;
  if (sslStatus && sslStatus !== 'READY') {
    // Not necessarily an issue; it can be IN_PROGRESS.
  }
  const endpoints = ssl?.json?.endpoints;
  const grade = Array.isArray(endpoints) && endpoints[0]?.grade ? endpoints[0].grade : null;
  if (grade && grade !== 'A+' && grade !== 'A') {
    issues.push(`SSL grade: ${grade}`);
    wins.push('Improve TLS/SSL configuration (aim for A grade).');
  }

  if (meta) {
    if (!meta.title) issues.push('Missing <title> tag');
    if (!meta.description) issues.push('Missing meta description');
    if (!meta.ogTitle) issues.push('Missing og:title');
    if (!meta.ogDescription) issues.push('Missing og:description');
    if (!meta.title) wins.push('Add a clear page title (<title>) targeting your main service + area.');
    if (!meta.description) wins.push('Add a compelling meta description (benefit + trust + CTA).');
  }

  return {
    issues: Array.from(new Set(issues)).slice(0, 12),
    quickWins: Array.from(new Set(wins)).slice(0, 10)
  };
}

function overallScore(pagespeed) {
  const c = pagespeed?.lighthouse?.categories;
  const vals = [];
  for (const k of ['performance', 'bestPractices', 'seo', 'accessibility']) {
    const v = c?.[k];
    if (typeof v === 'number') vals.push(v);
  }
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
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

  const issuesAndWins = computeIssuesAndQuickWins(pagespeed, ssl, meta);
  const score = overallScore(pagespeed);

  const results = {
    ok: true,
    input: { url, email },
    score,
    issues: issuesAndWins.issues,
    pagespeed,
    ssl: ssl.json || { ok: ssl.ok, status: ssl.status },
    meta,
    quickWins: issuesAndWins.quickWins
  };

  // Store lead (best-effort). Prefer KV binding named LEADS.
  try {
    if (env?.LEADS && typeof env.LEADS.put === 'function') {
      const key = `lead:${Date.now()}:${email.toLowerCase()}`;
      const lead = {
        email,
        url,
        issues: results.issues || [],
        score: results.score,
        date: new Date().toISOString().slice(0, 10),
        followedUp: false,
        results
      };

      await env.LEADS.put(key, JSON.stringify(lead), {
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
