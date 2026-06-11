/**
 * Copy to config.js and fill before deploy:
 *   cp assets/config.example.js assets/config.js
 *
 * assets/config.js is gitignored — never commit live URLs or invite tokens.
 */
window.PHARE_CONFIG = Object.freeze({
    API_URL: 'https://phare-intake.YOUR_SUBDOMAIN.workers.dev/api/intake',
    PUBKEY_URL: 'https://phare-intake.YOUR_SUBDOMAIN.workers.dev/api/intake/pubkey',
    REGISTRY_EMAIL: 'registry@phare.lighthouse',

    /** Optional SHA-256 fingerprint of canonical public JWK (run: npm run fingerprint) */
    PUBKEY_FINGERPRINT: null,

    /** Optional invite token — must match Worker secret INVITE_TOKEN if set */
    INVITE_TOKEN: null
});