/**
 * Headless transmit smoke test against live GitHub Pages.
 */
import { chromium } from 'playwright';

const URL = process.env.PHARE_URL || 'https://ahmadmalik77.github.io/phare-registry/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleLogs = [];
const pageErrors = [];
const failed = [];

page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', err => pageErrors.push(String(err)));
page.on('requestfailed', req => {
    failed.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'fail'}`);
});

const responses = [];
page.on('response', async res => {
    const u = res.url();
    if (u.includes('phare-intake') || u.includes('config.js') || u.includes('app.js')) {
        responses.push(`${res.status()} ${u}`);
    }
});

try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);

    // Capture config
    const cfg = await page.evaluate(() => window.PHARE_CONFIG || null);
    console.log('PHARE_CONFIG', cfg);

    await page.click('#btn-initiate');
    await page.waitForTimeout(400);

    // Steps 1-6: pick first option each time
    for (let step = 1; step <= 6; step++) {
        const opt = page.locator(`#s${step} .opt`).first();
        await opt.click();
        await page.waitForTimeout(150);
        const go = page.locator(`#s${step} .nav-btn.go`);
        await go.click();
        await page.waitForTimeout(250);
    }

    await page.fill('#a7_name', 'Test User');
    await page.fill('#a7_contact', 'test@example.com');
    await page.waitForTimeout(200);

    const btnDisabled = await page.locator('#btn-transmit').isDisabled();
    console.log('transmit disabled before click?', btnDisabled);

    // Hook console for transmit errors
    await page.click('#btn-transmit');
    await page.waitForTimeout(8000);

    const errText = await page.locator('#transmit-error').innerText().catch(() => '');
    const successVisible = await page.locator('#panel-success').evaluate(el => !el.classList.contains('off')).catch(() => false);
    const intakeHidden = await page.locator('#panel-intake').evaluate(el => el.classList.contains('off') || el.getAttribute('aria-hidden') === 'true').catch(() => false);

    console.log('--- RESULT ---');
    console.log('error banner:', JSON.stringify(errText));
    console.log('success visible:', successVisible);
    console.log('intake hidden:', intakeHidden);
    console.log('--- CONSOLE ---');
    consoleLogs.forEach(l => console.log(l));
    console.log('--- PAGE ERRORS ---');
    pageErrors.forEach(l => console.log(l));
    console.log('--- FAILED REQUESTS ---');
    failed.forEach(l => console.log(l));
    console.log('--- KEY RESPONSES ---');
    responses.forEach(l => console.log(l));
} finally {
    await browser.close();
}
