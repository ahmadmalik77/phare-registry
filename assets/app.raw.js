(function () {
    'use strict';


    const PHARE_VERSION = '2026.06-production.19';

    /*
     * PRODUCTION HARDENING (GitHub Pages host + Cloudflare Worker API):
     *
     * 1. Content-Security-Policy — actual policy lives in index.html meta CSP
     *    and deploy/_headers. Current production posture:
     *      default-src 'self'; script-src 'self';
     *      style-src 'self' 'unsafe-inline'  (required for cursor/animation JS
     *        setting element.style — not for inline HTML style attributes);
     *      font-src 'self'  (self-hosted woff2 — no Google Fonts CDN);
     *      img-src 'self' data:;
     *      connect-src 'self' https://phare-intake.…workers.dev;
     *      frame-ancestors 'none' (HTTP headers only, not meta);
     *      base-uri 'self'; form-action 'none'
     *
     * 2. Honeypot — #a7_hp_trap is visually hidden. Reject submissions where
     *    it is non-empty (client guard in submitToAPI; server must enforce too).
     *
     * 3. Rate limiting — enforce at POST /api/intake (e.g. 5 req/IP/hour via
     *    Cloudflare, API gateway, or express-rate-limit on the intake handler).
     *
     * 4. Timeouts & resilience — all outbound fetches use fetchWithTimeout
     *    (AbortController + 15-20s) to prevent hanging on bad networks.
     *
     * 5. Client-side attempt tracking — noteTransmitAttempt() provides
     *    contextual messaging for repeated failures without new UI.
     */

    /**
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    const el = id => document.getElementById(id);
    // Pre-cache a few hot elements for minor perf (non-visual)
    // This reduces repeated getElementById in the wizard hot path and transmit.
    // See also: note in PERFORMANCE section of comments.
    let cachedProgress, cachedStepLabel, cachedTransmitBtn, cachedNameInput, cachedContactInput;

    function isNetworkFetchFailure(err) {
        if (!err) return false;
        const msg = String(err.message || '');
        return err.name === 'TypeError' && (
            msg.includes('Failed to fetch') ||
            msg.includes('NetworkError') ||
            msg.includes('Load failed')
        );
    }

    function networkFailureMessage() {
        return 'Cannot reach the registry API. Check your network connection — some networks block Cloudflare Workers (*.workers.dev). Try another connection or contact the registry operator.';
    }

    /* === Resilience helper (AbortController + timeout, non-visual) === */
    async function fetchWithTimeout(resource, options = {}, timeoutMs = 15000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(resource, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (err) {
            clearTimeout(id);
            if (err.name === 'AbortError') {
                throw new Error('Request timed out. Please check your connection or the registry endpoint.');
            }
            throw err;
        }
    }

    /* === Simple client-side attempt tracker for calmer messaging (session only) === */
    function noteTransmitAttempt() {
        try {
            const key = 'phare_tx_attempts';
            const now = Date.now();
            let data = JSON.parse(sessionStorage.getItem(key) || '{"count":0,"last":0}');
            if (now - data.last > 60000) data.count = 0; // reset after ~1min
            data.count++;
            data.last = now;
            sessionStorage.setItem(key, JSON.stringify(data));
            return data.count;
        } catch (_) { return 1; }
    }
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;
    const DRAFT_KEY = 'phare_intake_draft_v2';
    const DEVICE_KEY = 'phare_device_key_v2';
    const DRAFT_TTL_MS = 1000 * 60 * 60 * 4;

    const STEP_LABELS = {
        1: 'Step 1 of 7: Operational visibility',
        2: 'Step 2 of 7: Where does weight concentrate',
        3: 'Step 3 of 7: Structural access point',
        4: 'Step 4 of 7: What creates the most pressure today',
        5: 'Step 5 of 7: What would bring the greatest relief',
        6: 'Step 6 of 7: How would you prefer to begin',
        7: 'Step 7 of 7: Establish designation'
    };

    let lastIntakeData = null;
    let lastEncryptedPayload = null;
    let isProcessingCrypto = false;
    let draftSaveTimer = null;
    let pendingDraft = null;
    let hasTransmitted = false;
    const cursorState = {
        coreReady: false,
        active: false,
        visible: false,
        resizing: false,
        dotX: 0,
        dotY: 0,
        ringX: 0,
        ringY: 0,
        resizeTimer: null,
        rafId: null
    };

    /* === 3. CRYPTO (Drafts via inline Worker + ECDH for real registry intake) === */
    let cryptoWorker = null;
    let workerCallId = 0;
    const pendingResolvers = new Map();
    let lastFocusedBeforeModal = null;

    function getCryptoWorker() {
        if (cryptoWorker) return cryptoWorker;
        cryptoWorker = new Worker('assets/draft-crypto-worker.js');
        cryptoWorker.onmessage = function (e) {
            const { id, success, result, error } = e.data;
            const pending = pendingResolvers.get(id);
            if (!pending) return;
            pendingResolvers.delete(id);
            success ? pending.resolve(result) : pending.reject(new Error(error));
        };
        return cryptoWorker;
    }

    function runCryptoTask(action, payload, passphrase) {
        return new Promise((resolve, reject) => {
            const id = ++workerCallId;
            pendingResolvers.set(id, { resolve, reject });
            getCryptoWorker().postMessage({ id, action, payload, passphrase });
        });
    }

    function getDeviceKey() {
        let key = localStorage.getItem(DEVICE_KEY);
        if (!key) {
            key = crypto.randomUUID();
            localStorage.setItem(DEVICE_KEY, key);
        }
        return key;
    }

    /* === 4. DRAFT MANAGER (device-local, best-effort, uses worker above) === */
    /* NOTE: Drafts are encrypted with a random UUID stored in clear localStorage.
       This protects against casual local inspection only. For maximum privacy,
       complete the intake in a single session and clear data afterwards. */
    const DraftManager = {
        async save(draftObj) {
            try {
                const envelope = await runCryptoTask('encrypt', { ...draftObj, timestamp: Date.now() }, getDeviceKey());
                localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 2, ...envelope }));
                showDraftIndicator();
            } catch (_) {
                /* silent — draft persistence is best-effort */
            }
        },
        async load() {
            try {
                const raw = localStorage.getItem(DRAFT_KEY);
                if (!raw) return null;
                const envelope = JSON.parse(raw);
                if (!envelope?.ciphertext) return null;
                const draft = await runCryptoTask('decrypt', envelope, getDeviceKey());
                if (!draft?.timestamp || Date.now() - draft.timestamp > DRAFT_TTL_MS) {
                    DraftManager.clear();
                    return null;
                }
                return draft;
            } catch (_) {
                DraftManager.clear();
                return null;
            }
        },
        clear() {
            localStorage.removeItem(DRAFT_KEY);
            const indicator = el('draft-indicator');
            if (indicator) indicator.classList.remove('show');
        }
    };

    function resetAnimation(element) {
        element.style.animation = 'none';
        element.offsetHeight;
        element.style.animation = '';
    }

    function showDraftIndicator(immediate = false) {
        const indicator = el('draft-indicator');
        if (!indicator) return;
        indicator.classList.add('show');
        if (!immediate) setTimeout(() => indicator.classList.remove('show'), 2200);
    }

    function setPanelVisibility(panelId, visible) {
        const panel = el(panelId);
        if (!panel) return;
        panel.classList.toggle('off', !visible);
        panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (visible) panel.removeAttribute('tabindex');
    }

    function fade(outId, inId) {
        const out = el(outId);
        const incoming = el(inId);
        resetAnimation(out);
        setPanelVisibility(outId, false);
        setPanelVisibility(inId, true);
        resetAnimation(incoming);
        clearCursorHover();
    }

    function clearCursorHover() {
        el('cur-dot')?.classList.remove('hov');
        el('cur-ring')?.classList.remove('hov');
    }

    function setProgress(step) {
        // Use cached refs when available (perf)
        const progressEl = cachedProgress || el('intake-progress');
        const stepLabel = cachedStepLabel || el('step-label');
        if (progressEl) {
            progressEl.setAttribute('aria-valuenow', step);
            progressEl.setAttribute('aria-valuetext', STEP_LABELS[step] || `Step ${step} of 7`);
        }
        if (stepLabel) {
            stepLabel.textContent = `Step ${step} of 7`;
            // Non-visual a11y: the step-label already has aria-live=polite from markup.
            // Explicitly ensure screen readers get the full context on change.
            stepLabel.setAttribute('aria-label', `Current step: ${STEP_LABELS[step] || `Step ${step} of 7`}`);
        }
        for (let i = 1; i <= 7; i++) {
            const seg = el('seg-' + i);
            if (!seg) continue;
            seg.classList.remove('lit', 'active');
            if (i < step) seg.classList.add('lit');
            if (i === step) seg.classList.add('active');
        }
    }

    function getCurrentStep() {
        const active = document.querySelector('.step.on');
        return active ? parseInt(active.dataset.step, 10) || 1 : 1;
    }

    function collectDraft() {
        return {
            step: getCurrentStep(),
            a1: el('a1')?.value || '',
            a2: el('a2')?.value || '',
            a3: el('a3')?.value || '',
            a4: el('a4')?.value || '',
            a5: el('a5')?.value || '',
            a6: el('a6')?.value || '',
            a7_name: el('a7_name')?.value.trim() || '',
            a7_contact: el('a7_contact')?.value.trim() || ''
        };
    }

    function queueDraftSave() {
        clearTimeout(draftSaveTimer);
        draftSaveTimer = setTimeout(() => DraftManager.save(collectDraft()), 450);
    }

    function restorePick(stepId, value) {
        const step = el(stepId);
        if (!step) return;
        step.querySelectorAll('.opt').forEach(opt => {
            const selected = opt.dataset.value === value;
            opt.classList.toggle('chosen', selected);
            opt.setAttribute('aria-checked', selected ? 'true' : 'false');
        });
    }

    function updateGoButton(stepEl) {
        const hidden = stepEl.querySelector('input[type="hidden"]');
        const goBtn = stepEl.querySelector('.nav-btn.go');
        if (!goBtn || !hidden) return;
        const ready = Boolean(hidden.value);
        goBtn.classList.toggle('ready', ready);
        goBtn.disabled = !ready;
    }

    function restoreDraft(draft) {
        if (!draft) return;
        ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].forEach(key => {
            if (draft[key]) {
                el(key).value = draft[key];
                restorePick('s' + key.slice(1), draft[key]);
            }
        });
        if (draft.a7_name) el('a7_name').value = draft.a7_name;
        if (draft.a7_contact) el('a7_contact').value = draft.a7_contact;

        const targetStep = Math.min(Math.max(draft.step || 1, 1), 7);
        document.querySelectorAll('.step').forEach(step => step.classList.remove('on', 'reverse'));
        const targetEl = el('s' + targetStep);
        if (targetEl) {
            targetEl.classList.add('on');
            setProgress(targetStep);
            updateGoButton(targetEl);
            if (targetStep === 7) checkInputs();
            else targetEl.querySelector('.step-q')?.focus();
        }
        showDraftIndicator(true);
    }

    function getFocusableElements(container) {
        return Array.from(container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(node => node.offsetParent !== null || node === document.activeElement);
    }

    function attachFocusTrap(container, onEscape) {
        const handleKeydown = e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onEscape?.();
                return;
            }
            if (e.key !== 'Tab') return;
            const focusable = getFocusableElements(container);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        container.addEventListener('keydown', handleKeydown);
        return () => container.removeEventListener('keydown', handleKeydown);
    }

    let detachRestoreTrap = null;
    let detachClearTrap = null;

    function applyMotionPreference() {
        prefersReducedMotion = motionQuery.matches;
        document.body.classList.toggle('reduce-motion', prefersReducedMotion);
    }

    function showRestoreDialog(draft) {
        pendingDraft = draft;
        const dialog = el('restore-dialog');
        const card = dialog?.querySelector('.restore-card');
        dialog.classList.add('open');
        dialog.setAttribute('aria-hidden', 'false');
        lastFocusedBeforeModal = document.activeElement;
        if (detachRestoreTrap) detachRestoreTrap();
        if (card) {
            detachRestoreTrap = attachFocusTrap(card, () => {
                DraftManager.clear();
                hideRestoreDialog();
            });
        }
        el('btn-restore-accept')?.focus();
    }

    function hideRestoreDialog() {
        const dialog = el('restore-dialog');
        dialog.classList.remove('open');
        dialog.setAttribute('aria-hidden', 'true');
        pendingDraft = null;
        if (detachRestoreTrap) {
            detachRestoreTrap();
            detachRestoreTrap = null;
        }
        if (lastFocusedBeforeModal?.focus) {
            lastFocusedBeforeModal.focus();
            lastFocusedBeforeModal = null;
        }
    }

    function showClearDataDialog() {
        const dialog = el('clear-data-dialog');
        const card = dialog?.querySelector('.restore-card');
        dialog.classList.add('open');
        dialog.setAttribute('aria-hidden', 'false');
        lastFocusedBeforeModal = document.activeElement;
        if (detachClearTrap) detachClearTrap();
        if (card) {
            detachClearTrap = attachFocusTrap(card, hideClearDataDialog);
        }
        el('btn-clear-confirm')?.focus();
    }

    function hideClearDataDialog() {
        const dialog = el('clear-data-dialog');
        dialog.classList.remove('open');
        dialog.setAttribute('aria-hidden', 'true');
        if (detachClearTrap) {
            detachClearTrap();
            detachClearTrap = null;
        }
        if (lastFocusedBeforeModal?.focus) {
            lastFocusedBeforeModal.focus();
            lastFocusedBeforeModal = null;
        }
    }

    function showStep(fromStep, toStep, reverse) {
        const fromEl = el('s' + fromStep);
        const toEl = el('s' + toStep);
        fromEl.classList.remove('on', 'reverse');
        resetAnimation(toEl);
        toEl.classList.toggle('reverse', reverse);
        toEl.classList.add('on');
        updateGoButton(toEl);
        if (toStep === 7) checkInputs();
        toEl.querySelector('.step-q')?.focus();
        clearCursorHover();
        if (!reverse) queueDraftSave();
    }

    function isValidContact(str) {
        if (!str || str.trim().length < 5) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(str.trim()) ||
               /^[\d\s\-\+\(\)\.]{7,25}$/.test(str.trim());
    }

    function isValidName(str) {
        if (!str) return false;
        const val = str.trim();
        return val.length >= 2 && /^(?=.*[A-Za-zÀ-ÿ])[A-Za-zÀ-ÿ\s'.-]{2,}$/.test(val);
    }

    function validateNameField() {
        const input = el('a7_name');
        const error = el('name-error');
        if (!input || !error) return true;
        const val = input.value.trim();
        if (!val) {
            input.classList.remove('invalid');
            error.classList.remove('show');
            return true;
        }
        const valid = isValidName(val);
        input.classList.toggle('invalid', !valid);
        error.classList.toggle('show', !valid);
        return valid;
    }

    function validateContactField() {
        const input = el('a7_contact');
        const error = el('contact-error');
        if (!input || !error) return true;
        const val = input.value.trim();
        if (!val) {
            input.classList.remove('invalid');
            error.classList.remove('show');
            return true;
        }
        const valid = isValidContact(val);
        input.classList.toggle('invalid', !valid);
        error.classList.toggle('show', !valid);
        return valid;
    }

    function checkInputs() {
        // Use cached inputs when available (perf + consistency)
        const btn = cachedTransmitBtn || el('btn-transmit');
        const nameInput = cachedNameInput || el('a7_name');
        const contactInput = cachedContactInput || el('a7_contact');
        const nameOk = isValidName(nameInput.value);
        const contactOk = isValidContact(contactInput.value.trim());
        const ready = nameOk && contactOk;
        btn.classList.toggle('ready', ready);
        btn.disabled = !ready;
        if (ready) {
            nameInput.classList.remove('invalid');
            el('name-error').classList.remove('show');
            contactInput.classList.remove('invalid');
            el('contact-error').classList.remove('show');
        }
        return ready;
    }

    function playSuccessCelebration() {
        const panel = el('panel-success');
        if (!panel) return;

        if (prefersReducedMotion) {
            panel.classList.add('celebrate-static');
            setTimeout(() => panel.classList.remove('celebrate-static'), 1200);
            return;
        }

        const container = el('success-confetti');
        if (container) {
            container.innerHTML = '';
            for (let i = 0; i < 8; i++) {
                const piece = document.createElement('span');
                piece.className = 'confetti-piece';
                piece.style.setProperty('--x', `${18 + Math.random() * 64}%`);
                piece.style.setProperty('--r', `${Math.random() * 360}deg`);
                piece.style.setProperty('--d', `${Math.random() * 0.25}s`);
                piece.style.opacity = String(0.12 + Math.random() * 0.18);
                container.appendChild(piece);
            }
        }

        panel.classList.remove('celebrate');
        panel.offsetHeight;
        panel.classList.add('celebrate');
        setTimeout(() => {
            panel.classList.remove('celebrate');
            if (container) container.innerHTML = '';
        }, 2800);
    }

    function setTransmitError(message) {
        const banner = el('transmit-error');
        if (!banner) return;
        if (message) {
            banner.textContent = message;
            banner.classList.add('show');
        } else {
            banner.textContent = '';
            banner.classList.remove('show');
        }
    }

    function setSuccessActionsEnabled(enabled, options = {}) {
        const { hideTransmit = false } = options;
        const panel = el('panel-success');
        const copyBtn = el('btn-copy-payload');
        const openBtn = el('btn-open-channel');
        const decryptBtn = el('btn-demo-decrypt');

        if (panel) {
            panel.classList.toggle('is-complete', Boolean(hideTransmit));
        }

        if (copyBtn) copyBtn.disabled = !enabled;
        if (decryptBtn) decryptBtn.disabled = !enabled;

        if (openBtn) {
            if (hideTransmit) {
                openBtn.classList.add('transmitted-hidden');
                openBtn.disabled = true;
            } else {
                openBtn.classList.remove('transmitted-hidden');
                openBtn.disabled = !enabled;
            }
        }
    }

    function getEncryptedPayloadString() {
        if (!lastEncryptedPayload) return null;
        return btoa(JSON.stringify(lastEncryptedPayload));
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
        }
    }

    function closeModal(overlay) {
        overlay.remove();
        if (lastFocusedBeforeModal?.focus) {
            lastFocusedBeforeModal.focus();
            lastFocusedBeforeModal = null;
        }
    }

    function openModal(title, content, note) {
        const existing = el('phare-verification-modal');
        if (existing) existing.remove();

        lastFocusedBeforeModal = document.activeElement;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'phare-verification-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'phare-modal-title');

        const card = document.createElement('div');
        card.className = 'modal-card';

        const heading = document.createElement('div');
        heading.className = 'modal-title';
        heading.id = 'phare-modal-title';
        heading.textContent = title;

        const pre = document.createElement('pre');
        pre.className = 'modal-pre';
        pre.textContent = content;

        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'modal-close';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => closeModal(overlay));

        footer.appendChild(closeBtn);
        card.appendChild(heading);
        card.appendChild(pre);
        if (note) {
            const noteEl = document.createElement('p');
            noteEl.className = 'modal-note';
            noteEl.textContent = note;
            card.appendChild(noteEl);
        }
        card.appendChild(footer);
        overlay.appendChild(card);

        attachFocusTrap(card, () => closeModal(overlay));
        document.body.appendChild(overlay);
        closeBtn.focus();
    }

    function getHoneypotValue() {
        return el('a7_hp_trap')?.value?.trim() || '';
    }

    function clearHoneypot() {
        const hp = el('a7_hp_trap');
        if (hp) hp.value = '';
    }

    async function submitToAPI(encryptedPayload) {
        /* Honeypot: bots fill hidden fields — name/email autofill must not trip this */
        if (getHoneypotValue()) {
            throw new Error('Invalid submission');
        }

        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        const invite = CONFIG.INVITE_TOKEN || sessionStorage.getItem('phare_invite_token');
        if (invite) headers['X-Phare-Invite'] = invite;

        const response = await fetchWithTimeout(CONFIG.API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ...encryptedPayload,
                b_hp_x7k9: ''
            })
        }, 20000);
        if (response.status === 429) throw new Error('Server responded 429');
        if (!response.ok) {
            let serverMsg = '';
            try {
                const errBody = await response.json();
                serverMsg = errBody?.error ? String(errBody.error) : '';
            } catch (_) { /* non-JSON error body */ }
            throw new Error(`Server responded ${response.status}${serverMsg ? ': ' + serverMsg : ''}`);
        }
        return response.json().catch(() => ({}));
    }

    // applyDemoMode removed — this is the pure production build (ECDH only).
    // All UI text for production is already present in the static markup.

    function uint8ToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    /* === 3b. PRODUCTION ECDH HELPERS (the real registry encryption path) === */
    async function generateECDHKeyPair() {
        return crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits']
        );
    }

    /**
     * deriveBits + raw AES import — maximum browser compatibility for ECDH peers.
     */
    async function deriveSharedAESKey(privateKey, peerPublicKey) {
        const bits = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: peerPublicKey },
            privateKey,
            256
        );
        return crypto.subtle.importKey(
            'raw',
            bits,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function importRegistryPublicKey(jwk) {
        const clean = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
        try {
            return await crypto.subtle.importKey(
                'jwk',
                clean,
                { name: 'ECDH', namedCurve: 'P-256' },
                true,
                []
            );
        } catch (_) {
            return crypto.subtle.importKey(
                'jwk',
                clean,
                { name: 'ECDH', namedCurve: 'P-256' },
                false,
                []
            );
        }
    }

    /**
     * Fetch the registry's current public ECDH key (P-256 JWK).
     * Uses short timeout and no-store to ensure freshness.
     * @returns {Promise<CryptoKey>} public key for derive
     */

    async function fingerprintPublicJwk(jwk) {
        const canonical = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function fetchRegistryPublicKey() {
        const res = await fetchWithTimeout(CONFIG.PUBKEY_URL, {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        }, 15000);
        if (!res.ok) throw new Error(`Could not reach registry key endpoint (${res.status})`);
        const data = await res.json();
        if (CONFIG.PUBKEY_FINGERPRINT) {
            const fp = await fingerprintPublicJwk(data.publicKey);
            if (fp !== CONFIG.PUBKEY_FINGERPRINT.toLowerCase()) {
                throw new Error('Registry public key fingerprint mismatch — possible interception');
            }
        }
        return importRegistryPublicKey(data.publicKey);
    }

    /**
     * Core production encryption path.
     * 1. Fetch registry pubkey
     * 2. Generate ephemeral client keypair
     * 3. ECDH derive shared AES-GCM key
     * 4. Encrypt payload + random IV
     * Returns the exact shape the Worker expects and validatePayload accepts.
     * @param {object} payload - the intake data
     */
    async function encryptForRegistry(payload) {
        const registryPub = await fetchRegistryPublicKey();
        const ephemeral = await generateECDHKeyPair();
        const sharedKey = await deriveSharedAESKey(ephemeral.privateKey, registryPub);
        const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            sharedKey,
            new TextEncoder().encode(JSON.stringify(payload))
        );
        return {
            v: 'phare-aes-gcm-ecdh-v2',
            ephemeralPublicKey,
            iv: uint8ToBase64(iv),
            ciphertext: uint8ToBase64(new Uint8Array(ciphertext))
        };
    }

    function clampCursorPosition() {
        const maxX = Math.max(0, window.innerWidth - 1);
        const maxY = Math.max(0, window.innerHeight - 1);
        cursorState.dotX = Math.min(Math.max(cursorState.dotX, 0), maxX);
        cursorState.dotY = Math.min(Math.max(cursorState.dotY, 0), maxY);
        cursorState.ringX = Math.min(Math.max(cursorState.ringX, 0), maxX);
        cursorState.ringY = Math.min(Math.max(cursorState.ringY, 0), maxY);
    }

    function syncCustomCursorElements() {
        const dot = el('cur-dot');
        const ring = el('cur-ring');
        if (!dot || !ring || !cursorState.active) return;
        dot.style.removeProperty('display');
        ring.style.removeProperty('display');
        clampCursorPosition();
        dot.style.left = cursorState.dotX + 'px';
        dot.style.top = cursorState.dotY + 'px';
        ring.style.left = cursorState.ringX + 'px';
        ring.style.top = cursorState.ringY + 'px';
    }

    function stopCursorRingLoop() {
        if (cursorState.rafId != null) {
            cancelAnimationFrame(cursorState.rafId);
            cursorState.rafId = null;
        }
    }

    function startCursorRingLoop() {
        if (cursorState.rafId != null) return;
        if (!cursorState.active || !cursorState.visible) return;

        const step = () => {
            cursorState.rafId = null;
            if (!cursorState.active || !cursorState.visible) return;
            const ring = el('cur-ring');
            if (ring) {
                cursorState.ringX += (cursorState.dotX - cursorState.ringX) * 0.14;
                cursorState.ringY += (cursorState.dotY - cursorState.ringY) * 0.14;
                ring.style.left = cursorState.ringX + 'px';
                ring.style.top = cursorState.ringY + 'px';
            }
            cursorState.rafId = requestAnimationFrame(step);
        };
        cursorState.rafId = requestAnimationFrame(step);
    }

    function setCustomCursorVisible(visible) {
        const dot = el('cur-dot');
        const ring = el('cur-ring');
        if (!dot || !ring) return;
        cursorState.visible = visible;
        if (!cursorState.active) {
            dot.classList.add('cur-hidden');
            ring.classList.add('cur-hidden');
            stopCursorRingLoop();
            return;
        }
        dot.classList.toggle('cur-hidden', !visible);
        ring.classList.toggle('cur-hidden', !visible);
        if (visible) {
            dot.style.opacity = '0.85';
            ring.style.opacity = '1';
            startCursorRingLoop();
        } else {
            stopCursorRingLoop();
        }
    }

    function setCustomCursorActive(active) {
        cursorState.active = active;
        document.body.classList.toggle('has-custom-cursor', active);
        if (!active) {
            clearCursorHover();
            setCustomCursorVisible(false);
            stopCursorRingLoop();
            return;
        }
        syncCustomCursorElements();
        setCustomCursorVisible(true);
    }

    function updateCustomCursorMode() {
        if (prefersReducedMotion) {
            if (cursorState.coreReady) setCustomCursorActive(false);
            return;
        }
        if (!cursorState.coreReady) initCustomCursorCore();
        setCustomCursorActive(true);
    }

    function onCustomCursorMove(e) {
        if (!cursorState.active) return;
        const dot = el('cur-dot');
        const ring = el('cur-ring');
        if (!dot || !ring) return;
        if (!cursorState.visible) setCustomCursorVisible(true);
        cursorState.dotX = e.clientX;
        cursorState.dotY = e.clientY;
        dot.style.left = cursorState.dotX + 'px';
        dot.style.top = cursorState.dotY + 'px';

        const hoverTarget = e.target.closest('button, .opt, .cta, .nav-btn, .secure-btn, .text-input');
        const interactive = hoverTarget && getComputedStyle(hoverTarget).pointerEvents !== 'none';
        dot.classList.toggle('hov', interactive);
        ring.classList.toggle('hov', interactive);
    }

    function onCustomCursorLeave() {
        if (cursorState.resizing) return;
        if (cursorState.active) setCustomCursorVisible(false);
    }

    function onCustomCursorEnter() {
        if (cursorState.active) setCustomCursorVisible(true);
    }

    function onCustomCursorResize() {
        cursorState.resizing = true;
        clearTimeout(cursorState.resizeTimer);
        clampCursorPosition();
        updateCustomCursorMode();
        if (cursorState.active) {
            syncCustomCursorElements();
            setCustomCursorVisible(true);
        }
        cursorState.resizeTimer = setTimeout(() => {
            cursorState.resizing = false;
            updateCustomCursorMode();
            if (cursorState.active) {
                syncCustomCursorElements();
                setCustomCursorVisible(true);
            }
        }, 150);
    }

    function initCustomCursorCore() {
        if (cursorState.coreReady) return;
        cursorState.coreReady = true;

        const dot = el('cur-dot');
        const ring = el('cur-ring');
        if (!dot || !ring) return;

        document.addEventListener('pointermove', onCustomCursorMove, { passive: true });
        document.addEventListener('pointerdown', onCustomCursorMove, { passive: true });
        document.documentElement.addEventListener('mouseleave', onCustomCursorLeave);
        document.documentElement.addEventListener('mouseenter', onCustomCursorEnter);
        window.addEventListener('resize', onCustomCursorResize, { passive: true });
        window.addEventListener('orientationchange', onCustomCursorResize, { passive: true });

        if (cursorState.active && cursorState.visible) startCursorRingLoop();

        if (!prefersReducedMotion) {
            const leftCol = el('col-left');
            const ghostP = document.querySelector('.ghost-p');
            if (leftCol) {
                leftCol.addEventListener('mousemove', e => {
                    const r = leftCol.getBoundingClientRect();
                    const x = (e.clientX - r.left) / r.width - 0.5;
                    const y = (e.clientY - r.top) / r.height - 0.5;
                    if (ghostP) {
                        ghostP.style.transform = `translate(${Math.round(x * 14)}px, ${Math.round(y * 10)}px)`;
                    }
                });
                leftCol.addEventListener('mouseleave', () => {
                    if (ghostP) ghostP.style.transform = 'translate(0, 0)';
                });
            }
        }
    }

    function initCustomCursor() {
        updateCustomCursorMode();
    }

    function dismissInitLoader() {
        const loader = el('init-loader');
        if (!loader) return;
        loader.classList.add('done');
        loader.setAttribute('aria-hidden', 'true');
    }

    function clearAllLocalData() {
        DraftManager.clear();
        localStorage.removeItem(DEVICE_KEY);
        lastIntakeData = null;
        lastEncryptedPayload = null;
    }

    function initKeyboardNavigation() {
        document.querySelectorAll('.step[data-step]').forEach(stepEl => {
            const radiogroup = stepEl.querySelector('[role="radiogroup"]');
            if (!radiogroup) return;
            const options = Array.from(radiogroup.querySelectorAll('.opt'));
            const inputId = 'a' + stepEl.dataset.step;

            options.forEach((opt, index) => {
                opt.setAttribute('tabindex', index === 0 ? '0' : '-1');
                opt.addEventListener('keydown', e => {
                    let newIndex = options.indexOf(opt);
                    switch (e.key) {
                        case 'ArrowDown':
                        case 'ArrowRight':
                            e.preventDefault();
                            newIndex = (newIndex + 1) % options.length;
                            break;
                        case 'ArrowUp':
                        case 'ArrowLeft':
                            e.preventDefault();
                            newIndex = (newIndex - 1 + options.length) % options.length;
                            break;
                        case 'Home':
                            e.preventDefault();
                            newIndex = 0;
                            break;
                        case 'End':
                            e.preventDefault();
                            newIndex = options.length - 1;
                            break;
                        case ' ':
                        case 'Enter':
                            e.preventDefault();
                            API.pick(opt, inputId, opt.dataset.value);
                            return;
                        default:
                            return;
                    }
                    options.forEach(o => o.setAttribute('tabindex', '-1'));
                    options[newIndex].setAttribute('tabindex', '0');
                    options[newIndex].focus();
                });
                opt.addEventListener('click', () => {
                    options.forEach(o => o.setAttribute('tabindex', '-1'));
                    opt.setAttribute('tabindex', '0');
                });
            });
        });
    }

    function bindEvents() {
        el('btn-initiate')?.addEventListener('click', () => API.goIntake());

        document.querySelectorAll('.opt').forEach(opt => {
            opt.addEventListener('click', () => {
                const step = opt.closest('.step');
                if (!step) return;
                API.pick(opt, 'a' + step.dataset.step, opt.dataset.value);
            });
        });

        document.querySelectorAll('.nav-btn[data-next]').forEach(btn => {
            btn.addEventListener('click', () => {
                const step = btn.closest('.step');
                if (!step) return;
                API.nextStep(parseInt(step.dataset.step, 10), parseInt(btn.dataset.next, 10));
            });
        });

        document.querySelectorAll('.nav-btn[data-prev]').forEach(btn => {
            btn.addEventListener('click', () => {
                const step = btn.closest('.step');
                if (!step) return;
                API.prevStep(parseInt(step.dataset.step, 10), parseInt(btn.dataset.prev, 10));
            });
        });

        el('btn-transmit')?.addEventListener('click', () => API.transmit());
        el('btn-copy-payload')?.addEventListener('click', () => API.copyEncryptedPayload());
        el('btn-open-channel')?.addEventListener('click', () => API.openSecureChannel());
        el('btn-demo-decrypt')?.addEventListener('click', () => API.demoDecrypt());

        el('a7_name')?.addEventListener('input', () => {
            if (el('name-error').classList.contains('show')) validateNameField();
            checkInputs();
            queueDraftSave();
        });
        el('a7_name')?.addEventListener('blur', validateNameField);

        el('a7_contact')?.addEventListener('input', () => {
            if (el('contact-error').classList.contains('show')) validateContactField();
            checkInputs();
            queueDraftSave();
        });
        el('a7_contact')?.addEventListener('blur', validateContactField);
        el('a7_contact')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                API.transmit();
            }
        });

        el('btn-restore-accept')?.addEventListener('click', () => {
            if (pendingDraft) restoreDraft(pendingDraft);
            hideRestoreDialog();
        });
        el('btn-restore-decline')?.addEventListener('click', () => {
            DraftManager.clear();
            hideRestoreDialog();
        });

        el('btn-clear-data')?.addEventListener('click', showClearDataDialog);
        el('btn-clear-cancel')?.addEventListener('click', hideClearDataDialog);
        el('btn-clear-confirm')?.addEventListener('click', () => {
            hideClearDataDialog();
            API.reset();
        });
    }

    const API = {
        goIntake: async () => {
            fade('panel-landing', 'panel-intake');
            setProgress(1);
            el('s1')?.querySelector('.step-q')?.focus();

            const draft = await DraftManager.load();
            if (draft) {
                setTimeout(() => showRestoreDialog(draft), 650);
            }
        },

        pick: (node, inputId, val) => {
            const radiogroup = node.closest('[role="radiogroup"]');
            radiogroup.querySelectorAll('.opt').forEach(o => {
                o.classList.remove('chosen');
                o.setAttribute('aria-checked', 'false');
                o.setAttribute('tabindex', '-1');
            });
            node.classList.add('chosen');
            node.setAttribute('aria-checked', 'true');
            node.setAttribute('tabindex', '0');
            el(inputId).value = val;
            updateGoButton(node.closest('.step'));
            queueDraftSave();
        },

        nextStep: (from, to) => {
            if (!el('a' + from).value) return;
            showStep(from, to, false);
            setProgress(to);
        },

        prevStep: (from, to) => {
            showStep(from, to, true);
            setProgress(to);
        },

        validateNameField,
        validateContactField,
        checkInputs,
        saveDraft: queueDraftSave,

        transmit: async () => {
            if (isProcessingCrypto) return;
            if (!checkInputs()) {
                validateNameField();
                validateContactField();
                return;
            }

            isProcessingCrypto = true;
            setTransmitError('');
            clearHoneypot();
            const btn = el('btn-transmit');
            const originalLabel = btn.textContent;
            btn.classList.add('transmitting');
            btn.classList.remove('ready');
            btn.textContent = 'Encrypting...';
            btn.disabled = true;

            lastIntakeData = {
                operational_visibility: el('a1').value,
                weight_concentration: el('a2').value,
                access_point: el('a3').value,
                pressure_source: el('a4').value,
                relief_preference: el('a5').value,
                start_preference: el('a6').value,
                designation: el('a7_name').value.trim(),
                contact: el('a7_contact').value.trim(),
                timestamp: new Date().toISOString(),
                registry: 'Phare — The Lighthouse • 2026'
            };

            try {
                if (!crypto?.subtle) throw new Error('Web Crypto API unavailable. Serve over HTTPS.');
                lastEncryptedPayload = await encryptForRegistry(lastIntakeData);
                await submitToAPI(lastEncryptedPayload);
                hasTransmitted = true;

                fade('panel-intake', 'panel-success');
                playSuccessCelebration();
                DraftManager.clear();
                setSuccessActionsEnabled(true, { hideTransmit: hasTransmitted });
                lastIntakeData = null;
                setTimeout(() => {
                    const successPanel = el('panel-success');
                    if (successPanel) {
                        successPanel.setAttribute('tabindex', '-1');
                        successPanel.focus({ preventScroll: true });
                    }
                }, 700);
            } catch (err) {
                console.error('[Phare transmit]', err);
                lastEncryptedPayload = null;
                const attempts = noteTransmitAttempt();
                const detail = String(err?.message || err || '');
                let baseMsg = 'Transmission failed. Data was not sent. Please retry or contact the registry directly.';
                if (isNetworkFetchFailure(err)) {
                    baseMsg = networkFailureMessage();
                } else if (detail.includes('429') || detail.toLowerCase().includes('rate limit')) {
                    baseMsg = 'Registry channel is momentarily constrained (rate limit). Please wait about an hour and retry, or try another network.';
                } else if (detail.includes('403') || detail.includes('Invitation required')) {
                    baseMsg = 'Registry channel declined this submission. Please contact the registry directly.';
                } else if (detail.includes('fingerprint mismatch')) {
                    baseMsg = 'Registry security check failed. Do not transmit on this connection — contact the registry directly.';
                } else if (detail.includes('Origin not allowed') || detail.includes('503')) {
                    baseMsg = 'Registry channel is temporarily unavailable. Please retry shortly.';
                } else if (detail.includes('registry key endpoint')) {
                    baseMsg = 'Could not verify the registry encryption key. Please retry or contact the registry directly.';
                } else if (detail.includes('timed out') || detail.includes('Timeout') || err?.name === 'AbortError') {
                    baseMsg = 'Request timed out. Check your connection and retry.';
                } else if (detail.startsWith('Server responded')) {
                    // Surface real API status (was previously hidden behind the generic line)
                    baseMsg = `Transmission failed (${detail}). Data was not sent. Please retry or contact the registry.`;
                } else if (detail) {
                    baseMsg = `Transmission failed: ${detail}`;
                }
                if (attempts >= 3) {
                    baseMsg += ' (Multiple recent attempts — waiting 30–60s may help; rate limit is per hour.)';
                }
                setTransmitError(baseMsg);
                btn.classList.remove('transmitting');
                btn.textContent = originalLabel;
                btn.disabled = false;
                checkInputs();
            } finally {
                isProcessingCrypto = false;
            }
        },

        copyEncryptedPayload: async () => {
            const payload = getEncryptedPayloadString();
            if (!payload) return;
            const btn = el('btn-copy-payload');
            const original = btn.textContent;
            const ok = await copyText(payload);
            btn.textContent = ok ? 'Copied to clipboard ✓' : 'Copy failed — try again';
            setTimeout(() => { btn.textContent = original; }, 2200);
        },

        openSecureChannel: async () => {
            const payload = getEncryptedPayloadString();
            if (!payload) return;

            // Production-only path (demo mailto branch removed)
            if (hasTransmitted) return;
            const btn = el('btn-open-channel');
            const original = btn.textContent;
            btn.textContent = 'Transmitting...';
            btn.disabled = true;
            try {
                await submitToAPI(lastEncryptedPayload);
                btn.textContent = 'Transmitted ✓';
                setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2200);
            } catch (_) {
                btn.textContent = original;
                btn.disabled = false;
                openModal(
                    'Transmission Failed',
                    'Could not reach the registry API. Your encrypted payload remains on this device.',
                    'Copy the payload and contact the registry directly if this persists.'
                );
            }
            return;
        },

        demoDecrypt: async () => { /* disabled in production build */ },

        reset: () => {
            hasTransmitted = false;
            clearAllLocalData();
            location.reload();
        }
    };

    applyMotionPreference();
    motionQuery.addEventListener('change', () => {
        applyMotionPreference();
        if (prefersReducedMotion) {
            const ghostP = document.querySelector('.ghost-p');
            if (ghostP) ghostP.style.transform = 'translate(0, 0)';
        }
        updateCustomCursorMode();
    });

    // applyDemoMode() removed (production build)
    initCustomCursor();
    initKeyboardNavigation();
    bindEvents();
    clearHoneypot();
    setSuccessActionsEnabled(false);

    // Cache hot elements once at startup (minor perf win, zero visual/aesthetic impact)
    // Reduces repeated DOM queries in setProgress, checkInputs, transmit hot paths.
    cachedProgress = el('intake-progress');
    cachedStepLabel = el('step-label');
    cachedTransmitBtn = el('btn-transmit');
    cachedNameInput = el('a7_name');
    cachedContactInput = el('a7_contact');

    window.addEventListener('beforeunload', () => {
        cryptoWorker?.terminate();
    });

    if (!crypto?.subtle) {
        setTimeout(() => {
            openModal(
                'HTTPS Required',
                'Web Crypto is unavailable. Deploy this page over HTTPS for encryption to work.',
                'Opening as a local file (file://) will block secure intake features.'
            );
        }, 600);
    }

    dismissInitLoader();
})();