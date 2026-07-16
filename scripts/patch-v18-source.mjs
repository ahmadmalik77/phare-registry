/**
 * Apply v18 audit patches to assets/app.raw.js (or seed from git HEAD).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rawPath = path.join(root, 'assets', 'app.raw.js');

let js;
if (fs.existsSync(rawPath) && fs.readFileSync(rawPath, 'utf8').includes('importRegistryPublicKey')) {
    js = fs.readFileSync(rawPath, 'utf8');
} else {
    js = execSync('git show HEAD:assets/app.js', { cwd: root, encoding: 'utf8' });
}
js = js.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

js = js.replace(
    /const PHARE_VERSION = ['"][^'"]+['"];/,
    "const PHARE_VERSION = '2026.06-production.18';"
);

const newCsp = `/*
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
     */`;

if (js.includes('fonts.gstatic.com') || js.includes("script-src 'self' 'unsafe-inline'")) {
    js = js.replace(
        /\/\*[\s\S]*?PRODUCTION HARDENING[\s\S]*?without new UI\.\s*\*\//,
        newCsp
    );
}

if (!js.includes('rafId: null')) {
    js = js.replace(
        /const cursorState = \{[\s\S]*?resizeTimer: null\n    \};/,
        `const cursorState = {
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
    };`
    );
}

if (!js.includes('startCursorRingLoop')) {
    const newCursorFns = `function stopCursorRingLoop() {
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
    }`;

    js = js.replace(
        /function setCustomCursorVisible\(visible\) \{[\s\S]*?function setCustomCursorActive\(active\) \{[\s\S]*?setCustomCursorVisible\(true\);\n    \}/,
        newCursorFns
    );
}

if (js.includes('trackCustomCursorRing')) {
    js = js.replace(
        /function trackCustomCursorRing\(\) \{[\s\S]*?requestAnimationFrame\(trackCustomCursorRing\);\n    \}\n\n    function initCustomCursorCore\(\) \{[\s\S]*?requestAnimationFrame\(trackCustomCursorRing\);\n\n        if \(!prefersReducedMotion\) \{/,
        `function initCustomCursorCore() {
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

        if (!prefersReducedMotion) {`
    );
}

if (!js.includes('successPanel.focus')) {
    js = js.replace(
        /fade\('panel-intake', 'panel-success'\);\n                playSuccessCelebration\(\);\n                DraftManager\.clear\(\);\n                setSuccessActionsEnabled\(true, \{ hideTransmit: hasTransmitted \}\);\n                lastIntakeData = null;/,
        `fade('panel-intake', 'panel-success');
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
                }, 700);`
    );
}

const checks = {
    version: js.includes('2026.06-production.18'),
    raf: js.includes('startCursorRingLoop'),
    focus: js.includes('successPanel.focus'),
    crypto: js.includes('importRegistryPublicKey'),
    noUnbounded: !js.includes('trackCustomCursorRing')
};

console.log('patch checks', checks);
// Always write current best; fail only if crypto missing
if (!checks.crypto) {
    console.error('patch-v18-source: missing production crypto');
    process.exit(1);
}
if (!checks.raf || !checks.focus || !checks.noUnbounded) {
    console.error('patch-v18-source: cursor/focus patches incomplete — inspect app.raw.js');
    process.exit(1);
}

fs.writeFileSync(rawPath, js.replace(/\r/g, ''), 'utf8');
console.log('wrote', rawPath, js.length, 'bytes');
