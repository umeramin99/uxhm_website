# UXHM - Digital Partner for UK Small Businesses

**UXHM** is a high-performance, static marketing website built to help UK small businesses scale through digital transformation.

This project is built on [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), based on the AstroWind template, and optimized for deployment on **Cloudflare Pages**.

![Status](https://img.shields.io/badge/Status-Live-success)
![Tech](https://img.shields.io/badge/Built%20With-Astro%20%7C%20Tailwind-blueviolet)

---

## 🚀 Tech Stack

* **Framework:** [Astro 5.0](https://astro.build/) (Static Site Generation)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Icons:** Tabler Icons & Iconify
* **Deployment:** Cloudflare Pages (Direct Upload)
* **Forms:** Cloudflare Worker + D1 + Resend (notifications) + Turnstile (bot protection)

---

## 📂 Project Structure


**UXHM** is a high-performance, static marketing website built to help UK small businesses scale through digital transformation.

This project is built on [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), based on the AstroWind template, and optimized for deployment on **Cloudflare Pages**.

![Status](https://img.shields.io/badge/Status-Live-success)
![Tech](https://img.shields.io/badge/Built%20With-Astro%20%7C%20Tailwind-blueviolet)

---

## 🚀 Tech Stack

* **Framework:** [Astro 5.0](https://astro.build/) (Static Site Generation)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Icons:** Tabler Icons & Iconify
* **Deployment:** Cloudflare Pages (Direct Upload)
* **Forms:** Cloudflare Worker (`worker/index.ts`) writing to a Cloudflare D1 database (`uxhm-leads`); email notifications via [Resend](https://resend.com); bot protection via Cloudflare Turnstile.

---

## 📂 Project Structure

Key directories and files you might need to edit:

```text
/
├── public/              # Static assets (robots.txt, etc.)
├── src/
│   ├── assets/          # Images and Icons
│   │   ├── images/      # Logo files (logo-light.png, logo-dark.png)
│   │   └── favicons/    # Browser tab icons
│   ├── components/
│   │   ├── Logo.astro   # Header Logo logic (Light/Dark swap)
│   │   ├── CustomStyles.astro # GLOBAL COLORS (Teal Theme)
│   │   └── widgets/     # UI Sections (Hero, Features, Footer)
│   ├── layouts/         # Page templates (PageLayout.astro)
│   └── pages/           # Website Routes
│       ├── index.astro  # Homepage
│       ├── services.astro
│       ├── pricing.astro
│       ├── about.astro
│       ├── work.astro
│       └── contact.astro
└── package.json         # Dependencies and scripts
