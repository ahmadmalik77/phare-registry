/**
 * Deploy config for https://ahmadmalik77.github.io/phare-registry/
 * Gitignored locally — force-add before push: git add -f assets/config.js
 *
 * Worker origin must match wrangler deploy output.
 * Cloudflare ALLOWED_ORIGINS must include: https://ahmadmalik77.github.io
 */
window.PHARE_CONFIG = Object.freeze({
    API_URL: 'https://phare-intake.ahmadmalik77.workers.dev/api/intake',
    PUBKEY_URL: 'https://phare-intake.ahmadmalik77.workers.dev/api/intake/pubkey',
    REGISTRY_EMAIL: 'registry@phare.lighthouse',
    PUBKEY_FINGERPRINT: '8a8a80ffdc3e2bf0770c9169af15763bd3425e65da9d918af5ae2b8e7a7b8386',
    INVITE_TOKEN: null
});