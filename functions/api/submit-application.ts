import type { PagesFunction } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const businessName = formData.get("business_name") as string;
    const industry = formData.get("industry") as string;
    const domainPreference = formData.get("domain_preference") as string;
    const message = formData.get("message") as string;
    const source = formData.get("source") as string;

    // Basic validation
    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, message: "Name and Email are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await env.DB.prepare(
      `INSERT INTO leads (name, email, business_name, industry, domain_preference, message, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(name, email, businessName, industry, domainPreference, message, source)
      .run();

    if (result.success) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      throw new Error("Database insert failed");
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, message: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
