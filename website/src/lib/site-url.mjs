/**
 * Calculate public site URL based on environment variables.
 * Priority:
 *   1. SITE_URL env variable (e.g., https://eval-quality.bmad-method.org/)
 *   2. GITHUB_REPOSITORY env variable (GitHub Pages default)
 *   3. Local fallback (http://localhost:3000)
 */
export function getSiteUrl() {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, '');
  }

  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    return `https://${owner}.github.io/${repo}`;
  }

  return 'http://localhost:3000';
}
