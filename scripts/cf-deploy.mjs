import { execSync } from 'node:child_process';

// Cloudflare build environments vary. We check multiple common vars.
const branch =
  process.env.CF_PAGES_BRANCH ||
  process.env.CF_WORKER_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  process.env.BRANCH ||
  process.env.CI_BRANCH ||
  '';

const isMain = branch === 'main' || branch === 'master' || process.env.FORCE_DEPLOY === '1';

// Names must match your Cloudflare Worker project.
const PROD_NAME = process.env.CF_WORKER_PROD_NAME || 'uxhmwebsite';
const PREVIEW_NAME = process.env.CF_WORKER_PREVIEW_NAME || 'uxhmwebsite-preview';

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

if (!branch) {
  console.warn(
    '[cf-deploy] Warning: No branch environment variable detected. Set CF_PAGES_BRANCH/GITHUB_REF_NAME/BRANCH, or set FORCE_DEPLOY=1.'
  );
}

if (isMain) {
  console.log(`[cf-deploy] Deploying PRODUCTION Pages project: ${PROD_NAME} (branch=${branch || 'unknown'})`);
  run(`npx wrangler pages deploy ./dist --project-name ${PROD_NAME} --branch ${branch || 'main'}`);
} else {
  console.log(`[cf-deploy] Deploying PREVIEW Pages project: ${PREVIEW_NAME} (branch=${branch || 'unknown'})`);
  // Preview deploys
  run(`npx wrangler pages deploy ./dist --project-name ${PROD_NAME} --branch ${branch}`);
}
