// Test-only dependencies live outside the application. See docs/VALIDACAO-SITE-2.md.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const only = option('only', '');
const baseline = args.includes('--baseline');
const label = option('label', baseline ? 'antes' : 'depois');
assert.match(label, /^[a-zA-Z0-9_-]+$/, 'O nome do relatório deve ser simples.');
const requireTools = createRequire(path.join(root, 'reports/website-tools/package.json'));
let chromium, AxeBuilder;
try {
  ({ chromium } = requireTools('playwright'));
  AxeBuilder = requireTools('@axe-core/playwright').default;
} catch {
  throw new Error('Instale apenas as ferramentas de teste: npm install --prefix reports/website-tools --no-save --package-lock=false playwright@1.65.1 @axe-core/playwright@4.14.0');
}

const output = path.join(root, 'output/playwright/facilid-2', label);
await mkdir(output, { recursive: true });
await mkdir(path.join(root, 'reports'), { recursive: true });
const report = {
  startedAt: new Date().toISOString(), baseline, label,
  environment: { platform: process.platform, node: process.version, playwright: requireTools('playwright/package.json').version,
    axe: JSON.parse(await readFile(path.join(root, 'reports/website-tools/node_modules/@axe-core/playwright/package.json'), 'utf8')).version,
    browser: 'Chrome', headless: !args.includes('--headed'),
    network: 'No emulated throttling; fresh browser contexts; local HTTP unless --url is supplied.',
    metrics: 'Laboratory observations. LCP before interaction; CLS session windows. Event Timing is recorded separately, not reported as field INP.' },
  checks: [], viewports: [], accessibility: [], performance: [], requests: [], errors: [], requestsFailed: [], responsesFailed: [],
};
const check = (name, fn) => async () => {
  if (only && !new RegExp(only, 'u').test(name)) return;
  const started = Date.now();
  try { const detail = await fn(); report.checks.push({ name, passed: true, durationMs: Date.now() - started, detail }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, durationMs: Date.now() - started, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
};
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
async function publicSourceHash(directory = path.join(root, 'website')) {
  const hash = createHash('sha256');
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) hash.update(await publicSourceHash(filename));
    else if (mime[path.extname(entry.name)]) hash.update(entry.name).update(await readFile(filename));
  }
  return hash.digest('hex');
}
report.sourceHash = await publicSourceHash();
let server;
async function localServer() {
  const directory = path.join(root, 'website');
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(directory + path.sep) || !mime[path.extname(file)] || !(await stat(file)).isFile()) {
        response.writeHead(404).end(); return;
      }
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' });
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}/`;
}

function observePerformance() {
  window.__siteMetrics = { lcp: null, cls: 0, interactions: [], supported: PerformanceObserver.supportedEntryTypes };
  let sessionValue = 0, sessionStart = 0, previousShift = 0;
  if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
    new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__siteMetrics.lcp = entry.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  }
  if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      if (entry.startTime - previousShift < 1000 && entry.startTime - sessionStart < 5000) sessionValue += entry.value;
      else { sessionValue = entry.value; sessionStart = entry.startTime; }
      previousShift = entry.startTime;
      window.__siteMetrics.cls = Math.max(window.__siteMetrics.cls, sessionValue);
    } }).observe({ type: 'layout-shift', buffered: true });
  }
  if (PerformanceObserver.supportedEntryTypes.includes('event')) {
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.interactionId) {
      window.__siteMetrics.interactions.push({ type: entry.name, duration: entry.duration, interactionId: entry.interactionId });
    } }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: !args.includes('--headed') });
report.environment.browserVersion = browser.version();
const url = option('url', null) ?? await localServer();
report.url = url;

async function newPage(viewport, options = {}) {
  const context = await browser.newContext({ viewport, locale: 'pt-BR', reducedMotion: 'no-preference', ...options });
  await context.addInitScript(observePerformance);
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => report.requests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() }));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', request => report.requestsFailed.push({ url: request.url(), failure: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.responsesFailed.push({ url: response.url(), status: response.status() }); });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(650);
  return page;
}

async function pageFacts(page) {
  return page.evaluate(() => {
    const clippedText = [];
    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (textNodes.nextNode()) {
      const node = textNodes.currentNode, parent = node.parentElement;
      if (!node.textContent.trim() || parent.closest('script,style,svg,.sr-only,.skip-link,[aria-hidden="true"],[hidden]') || getComputedStyle(parent).visibility !== 'visible') continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const outside = [...range.getClientRects()].find(rect => rect.width > 1 && rect.height > 1 && (rect.left < -1 || rect.right > innerWidth + 1));
      if (outside) clippedText.push({ tag: parent.tagName, id: parent.id, className: parent.className, text: node.textContent.trim().slice(0, 80), left: outside.left, right: outside.right });
    }
    const overflowing = [...document.querySelectorAll('body *')].filter(element => {
      if (element.closest('[hidden]') || getComputedStyle(element).display === 'none' || getComputedStyle(element).position === 'fixed') return false;
      const r = element.getBoundingClientRect();
      return r.width && (r.right > innerWidth + 1 || r.left < -1) && !element.closest('[aria-hidden="true"]');
    }).map(element => ({ tag: element.tagName, id: element.id, className: String(element.className), text: element.textContent.trim().slice(0, 80) })).slice(0, 20);
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    return {
      title: document.title, lang: document.documentElement.lang, h1: [...document.querySelectorAll('h1')].map(e => e.textContent.trim()),
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowing, clippedText,
      metrics: window.__siteMetrics,
      transferBytes: (navigation?.transferSize ?? 0) + resources.reduce((n, entry) => n + entry.transferSize, 0),
      encodedBodyBytes: (navigation?.encodedBodySize ?? 0) + resources.reduce((n, entry) => n + entry.encodedBodySize, 0),
      resources: resources.map(({ name, transferSize, encodedBodySize, duration }) => ({ name, transferSize, encodedBodySize, duration })),
      links: [...document.querySelectorAll('a[href]')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href'), valid: !a.hash || !!document.getElementById(decodeURIComponent(a.hash.slice(1))) })),
    };
  });
}

async function audit(page, name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const summarize = item => ({ id: item.id, impact: item.impact, description: item.description, helpUrl: item.helpUrl,
    nodes: item.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) });
  const summary = { name, violations: result.violations.map(summarize), incomplete: result.incomplete.map(summarize), passes: result.passes.length };
  report.accessibility.push(summary);
  if (!baseline) assert.equal(summary.violations.length, 0, `axe ${name}: ${summary.violations.map(v => v.id).join(', ')}`);
  return summary;
}

async function revealPage(page) {
  await page.evaluate(async () => {
    // Visit the entire page so lazy images and intersection-driven content are captured.
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 45));
    }
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(500);
}

async function exerciseSite() {
  const waitState = (page, state) => page.locator(`#demo-panel[data-state="${state}"]`).waitFor();
  const currentState = page => page.locator('#demo-panel').getAttribute('data-state');
  const start = async page => { await page.locator('#demo-primary').click(); await waitState(page, 'pin'); };
  const reset = async page => { await page.locator('#demo-reset').click(); await waitState(page, 'waiting'); };
  const snapshotDemo = (page, state) => page.locator('#demo-panel').screenshot({ path: path.join(output, `demo-${state}.png`) });
  const tabTo = async (page, selector) => {
    for (let i = 0; i < 90; i++) {
      if (await page.evaluate(query => document.activeElement.matches(query), selector)) return;
      await page.keyboard.press('Tab');
    }
    throw new Error(`Não foi possível alcançar ${selector} por Tab.`);
  };

  await check('editorial: remoções, aviso único e palavras separadas', async () => {
    const page = await newPage({ width: 640, height: 900 });
    try {
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      const removed = [
        'Mais autonomia. Menos barreiras.', 'Você no controle, do primeiro ao último passo.',
        'Representação ilustrativa do aplicativo.', 'Simples por fora. Pensado em cada detalhe.',
        'Mais clareza para decidir. Mais autonomia para continuar.', 'Somente nesta página. Sem cadastro.',
        'Uma demonstração, sem dados reais.',
        'Nada é enviado ou salvo. Não há leitura NFC, autenticação ou consulta a serviços nesta página.',
        'Recursos que trabalham juntos para tornar o caminho mais compreensível.', 'Cuidado em cada detalhe.',
      ];
      for (const phrase of removed) assert.ok(!text.includes(phrase.toLocaleLowerCase('pt-BR')), phrase);
      assert.equal(await page.locator('#demo-notice').count(), 1);
      assert.match(await page.locator('#demo-notice').innerText(), /sem leitura NFC, login ou envio de dados/);
      assert.match(await page.locator('.demo-mode').innerText(), /modo demonstração/i);
      assert.match((await page.locator('#people-title').innerText()).replace(/\s+/g, ' '), /Tecnologia que respeita o seu tempo/);
      assert.equal(await page.locator('.hero-footnote,.scene-label,.people-principle,.demo-disclaimer,.demo-panel-bottom,.hero-bottom').count(), 0);
      return { removedPhrases: removed.length, noticeCount: 1 };
    } finally { await page.context().close(); }
  })();

  await check('créditos: apresentação, links em nova aba e movimento reduzido', async () => {
    const results = [];
    for (const width of [1440, 390]) {
      const page = await newPage({ width, height: 900 });
      try {
        const footer = page.locator('.site-footer');
        await footer.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.site-footer').classList.contains('credits-arrived'));
        await page.waitForTimeout(750);
        assert.equal(await page.locator('.credits-title').innerText(), 'Projeto desenvolvido pelos alunos do SENAC.');
        assert.match((await page.locator('.credits-mention').innerText()).replace(/\s+/g, ' '), /Menção honrosa a @marcoszhp/);
        await footer.screenshot({ path: path.join(output, `credits-${width}.png`) });
        await audit(page, `créditos ${width}`);
        if (width === 1440) {
          for (const href of ['https://www.instagram.com/marcoszhp/', 'https://github.com/marcoszhp']) {
            const link = page.locator(`.footer-credits a[href="${href}"]`);
            assert.equal(await link.getAttribute('target'), '_blank');
            const rel = (await link.getAttribute('rel')).split(/\s+/);
            assert.ok(rel.includes('noopener') && rel.includes('noreferrer'));
            await link.focus();
            const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')]);
            await popup.waitForURL(location => location.hostname === new URL(href).hostname, { waitUntil: 'commit', timeout: 15000 });
            const openedUrl = popup.url();
            let load = 'loaded';
            try { await popup.waitForLoadState('domcontentloaded', { timeout: 8000 }); }
            catch { load = 'external-load-timeout'; }
            assert.ok(await popup.evaluate(() => window.opener === null));
            results.push({ href, openedUrl, load, openerIsNull: true });
            await popup.close();
          }
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.reload();
        await footer.scrollIntoViewIfNeeded();
        assert.equal(await page.locator('.footer-credits').evaluate(element => getComputedStyle(element).animationName), 'none');
      } finally { await page.context().close(); }
    }
    return results;
  })();

  await check('contraste de textos principais em superfícies sólidas', async () => {
    const page = await newPage({ width: 1440, height: 900 }, { reducedMotion: 'reduce' });
    try {
      const pairs = await page.evaluate(() => {
        const selectors = ['.hero-lede', '.hero-text-link', '.demo-mode', '#demo-status-description', '#demo-primary', '.demo-notice', '.credits-title', '.credits-mention', '.social-link'];
        return selectors.map(selector => {
          const element = document.querySelector(selector);
          const style = getComputedStyle(element);
          let current = element, background;
          while (current) {
            const value = getComputedStyle(current).backgroundColor;
            if (/^rgb\(/.test(value)) { background = value; break; }
            current = current.parentElement;
          }
          return { selector, color: style.color, background, fontSize: style.fontSize, fontWeight: style.fontWeight };
        });
      });
      const luminance = color => {
        const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      for (const pair of pairs) {
        assert.ok(pair.background, `Sem fundo sólido identificável para ${pair.selector}`);
        const a = luminance(pair.color), b = luminance(pair.background);
        pair.ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        assert.ok(pair.ratio >= 4.5, `${pair.selector}: contraste ${pair.ratio.toFixed(2)}:1`);
      }
      return { scope: 'Textos selecionados contra o fundo sólido ancestral; não certifica gradientes, imagens ou todos os pixels.', pairs };
    } finally { await page.context().close(); }
  })();

  await check('hero: quatro etapas, estado final e movimento reduzido', async () => {
    const page = await newPage({ width: 1440, height: 900 });
    try {
      const frames = [];
      for (const index of [0, 1, 2, 3]) {
        await page.waitForFunction(frame => document.querySelector('.hero').dataset.frame === String(frame), index);
        frames.push({ frame: index, heading: await page.locator('.app-title').innerText() });
        await page.locator('.hero-art').screenshot({ path: path.join(output, `hero-frame-${index}.png`) });
      }
      await page.waitForFunction(() => !document.querySelector('#replay-hero').disabled);
      assert.equal(await page.locator('.hero').getAttribute('data-frame'), '3');
      assert.match(frames[2].heading, /confirme/i);
      assert.match(frames[3].heading, /tudo pronto/i);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      assert.equal(await page.locator('.hero').getAttribute('data-frame'), '3');
      assert.ok(await page.locator('#replay-hero').isHidden());
      return { frames, reducedMotionFinalFrame: 3 };
    } finally { await page.context().close(); }
  })();

  await check('teclado: pular conteúdo, PIN, apagar, limpar, confirmar e foco', async () => {
    const page = await newPage({ width: 1440, height: 900 });
    try {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#conteudo');
      const focusStyle = await page.evaluate(() => ({ outline: getComputedStyle(document.activeElement).outlineStyle, outlineWidth: getComputedStyle(document.activeElement).outlineWidth }));
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement.id === 'conteudo');
      await tabTo(page, '#demo-primary');
      await page.keyboard.press('Enter');
      await waitState(page, 'pin');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.digit), '1', 'Foco não foi transferido ao teclado do PIN.');
      await page.keyboard.press('1'); await page.keyboard.press('2'); await page.keyboard.press('3');
      assert.match(await page.locator('#pin-count').innerText(), /^3 de 4/);
      await page.keyboard.press('Backspace');
      assert.match(await page.locator('#pin-count').innerText(), /^2 de 4/);
      await page.keyboard.press('Delete');
      assert.match(await page.locator('#pin-count').innerText(), /^0 de 4/);
      for (const digit of ['1','2','3','4']) await page.keyboard.press(digit);
      await tabTo(page, '#pin-delete');
      await page.keyboard.press('Enter');
      assert.match(await page.locator('#pin-count').innerText(), /^3 de 4/);
      await page.keyboard.press('4');
      await tabTo(page, '#demo-primary');
      await page.keyboard.press('Enter');
      await waitState(page, 'success');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'demo-primary', 'Foco não foi devolvido após confirmação.');
      await page.keyboard.press('Enter');
      await waitState(page, 'waiting');
      return { focusStyle, keyboardOnly: true };
    } finally { await page.context().close(); }
  })();

  await check('menu mobile: toque, teclado, Escape, destino e breakpoint', async () => {
    const page = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
    try {
      const menu = page.locator('.menu-toggle');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.ok(await page.locator('#site-nav').evaluate(element => element.inert));
      await menu.tap();
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      await audit(page, 'menu mobile aberto');
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.ok(await menu.evaluate(element => element === document.activeElement));
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#como-funciona');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement.id === 'como-funciona');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForFunction(() => document.querySelector('.menu-toggle').hidden && !document.querySelector('#site-nav').inert);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => !document.querySelector('.menu-toggle').hidden && document.querySelector('#site-nav').inert);
    } finally { await page.context().close(); }
  })();

  await check('âncoras, ampliar texto e rever animação', async () => {
    const page = await newPage({ width: 1440, height: 900 });
    try {
      const anchors = await page.locator('a[href^="#"]').count();
      for (let index = 0; index < anchors; index++) {
        const link = page.locator('a[href^="#"]').nth(index);
        if (await link.getAttribute('class') === 'skip-link') continue;
        const href = await link.getAttribute('href');
        await link.click();
        await page.waitForFunction(hash => location.hash === hash && document.activeElement.id === hash.slice(1), href);
      }
      const before = await page.locator('#type-preview-text').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      await page.locator('#type-preview-toggle').click();
      assert.equal(await page.locator('#type-preview-toggle').getAttribute('aria-pressed'), 'true');
      const after = await page.locator('#type-preview-text').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      assert.ok(after > before, 'O exemplo não aumentou.');
      await page.locator('#type-preview-toggle').click();
      assert.equal(await page.locator('#type-preview-toggle').getAttribute('aria-pressed'), 'false');
      await page.locator('#replay-hero').click();
      assert.ok(await page.locator('#replay-hero').isDisabled());
      await page.waitForFunction(() => !document.querySelector('#replay-hero').disabled, { timeout: 6000 });
      assert.equal(await page.locator('.hero').evaluate(element => element.classList.contains('is-animating')), false);
      return { anchorsClicked: anchors - 1, textSize: { before, enlarged: after } };
    } finally { await page.context().close(); }
  })();

  await check('conteúdo e navegação permanecem úteis sem JavaScript', async () => {
    const page = await newPage({ width: 390, height: 844 }, { javaScriptEnabled: false });
    try {
      assert.ok(await page.locator('h1').isVisible());
      assert.ok(await page.locator('#demo-js-fallback').isVisible());
      assert.ok(await page.locator('#demo-controls').isHidden());
      await page.locator('#site-nav a[href="#como-funciona"]').click();
      assert.ok(page.url().endsWith('#como-funciona'));
      const facts = await pageFacts(page);
      assert.ok(facts.scrollWidth <= facts.width + 1);
    } finally { await page.context().close(); }
  })();

  await check('demonstração: etapas, PIN inválido, recuperação, sucesso e reinício', async () => {
    const page = await newPage({ width: 1440, height: 900 });
    try {
      await waitState(page, 'waiting');
      await page.evaluate(() => {
        const panel = document.getElementById('demo-panel');
        window.__demoStates = [panel.dataset.state];
        new MutationObserver(() => window.__demoStates.push(panel.dataset.state)).observe(panel, { attributes: true, attributeFilter: ['data-state'] });
      });
      await snapshotDemo(page, 'waiting');
      await start(page);
      await snapshotDemo(page, 'pin');
      for (let i = 0; i < 4; i++) await page.locator('[data-digit="0"]').click();
      await page.locator('#demo-primary').click();
      await waitState(page, 'pin-error');
      await snapshotDemo(page, 'pin-error');
      await audit(page, 'demo pin-error');
      await page.locator('#pin-clear').click();
      await page.locator('#demo-fill-pin').click();
      await page.locator('#demo-primary').click();
      await waitState(page, 'confirming');
      await waitState(page, 'success');
      await snapshotDemo(page, 'success');
      assert.ok(await page.locator('#demo-reset').isHidden(), 'O sucesso deve oferecer apenas uma ação para começar novamente.');
      await audit(page, 'demo success');
      await page.locator('#demo-primary').click();
      await waitState(page, 'waiting');
      const states = await page.evaluate(() => [...new Set(window.__demoStates)]);
      for (const state of ['waiting', 'presented', 'processing', 'pin', 'pin-error', 'confirming', 'success']) assert.ok(states.includes(state), `Estado não observado: ${state}`);
      const metrics = await page.evaluate(() => window.__siteMetrics);
      report.performance.push({ name: 'real demo clicks', metrics });
      return { states, events: metrics.interactions };
    } finally { await page.context().close(); }
  })();

  await check('demonstração: cartão inválido, cancelamento e ausência de estado persistente', async () => {
    const page = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
    try {
      await page.locator('#demo-invalid').click();
      await waitState(page, 'invalid');
      await snapshotDemo(page, 'invalid');
      await audit(page, 'demo invalid mobile');
      await reset(page);
      await page.locator('#demo-primary').click();
      await reset(page);
      await page.waitForTimeout(2100);
      assert.equal(await currentState(page), 'waiting', 'Timer antigo alterou a demo após reinício.');
      await start(page);
      for (const digit of '0123456789') {
        await page.locator(`[data-digit="${digit}"]`).tap();
        assert.match(await page.locator('#pin-count').innerText(), /^1 de 4/);
        await page.locator('#pin-delete').tap();
        assert.match(await page.locator('#pin-count').innerText(), /^0 de 4/);
      }
      await reset(page);
      await start(page);
      await page.locator('#demo-fill-pin').click();
      await page.locator('#demo-primary').click();
      await waitState(page, 'confirming');
      await reset(page);
      await page.waitForTimeout(1200);
      assert.equal(await currentState(page), 'waiting', 'Confirmação antiga sobreviveu ao reinício.');
      await start(page);
      await page.reload();
      await waitState(page, 'waiting');
      return await page.evaluate(() => ({ localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage) }));
    } finally { await page.context().close(); }
  })();

  await check('reflow equivalente a zoom 200% e 400%', async () => {
    const results = [];
    // WCAG reflow: a 1280px-wide viewport at 400% is equivalent to 320 CSS px.
    // This checks the equivalent CSS viewport; it does not claim native browser zoom.
    for (const [zoom, width, height] of [[200,640,450],[400,320,225]]) {
      const page = await newPage({ width, height });
      try {
        let facts = await pageFacts(page);
        assert.ok(facts.scrollWidth <= width + 1, `Reflow ${zoom}% overflow`);
        assert.deepEqual(facts.clippedText, [], `Texto cortado no reflow ${zoom}%`);
        await start(page);
        await page.locator('#demo-fill-pin').click();
        await page.locator('#demo-primary').click();
        await waitState(page, 'success');
        facts = await pageFacts(page);
        assert.ok(facts.scrollWidth <= width + 1, `Demo ${zoom}% overflow`);
        assert.deepEqual(facts.clippedText, [], `Texto cortado na demo ${zoom}%`);
        await page.screenshot({ path: path.join(output, `reflow-${zoom}-full.png`), fullPage: true });
        results.push({ zoomEquivalentPercent: zoom, cssViewport: { width, height }, scrollWidth: facts.scrollWidth });
      } finally { await page.context().close(); }
    }
    return results;
  })();

  await check('movimento reduzido preserva a demonstração', async () => {
    const page = await newPage({ width: 390, height: 844 }, { reducedMotion: 'reduce', isMobile: true, hasTouch: true });
    try {
      const animations = await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        active: document.getAnimations().map(animation => ({ state: animation.playState, duration: animation.effect.getTiming().duration })) }));
      assert.ok(animations.reduced);
      assert.deepEqual(animations.active.filter(item => item.state === 'running' && item.duration > 1), [], 'Animação continua ativa com movimento reduzido.');
      await start(page);
      await page.locator('#demo-fill-pin').click();
      await page.locator('#demo-primary').click();
      await waitState(page, 'success');
      await page.screenshot({ path: path.join(output, 'reduced-motion.png'), fullPage: true });
      return animations;
    } finally { await page.context().close(); }
  })();

  await check('demo não transmite dados ou chama APIs', async () => {
    assert.deepEqual(report.requests.filter(request => request.method !== 'GET'), []);
    assert.deepEqual(report.requests.filter(request => ['fetch', 'xhr'].includes(request.resourceType)), []);
    assert.deepEqual(report.requests.filter(request => new URL(request.url).origin !== new URL(url).origin), []);
  })();
}

try {
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[768,1024],[390,844],[375,812]]) {
    await check(`viewport ${width}x${height}`, async () => {
      const page = await newPage({ width, height }, { isMobile: width < 500, hasTouch: width < 500 });
      try {
        if (!baseline) await page.waitForFunction(() => !document.querySelector('#replay-hero')?.disabled);
        const facts = await pageFacts(page);
        report.viewports.push({ viewport: `${width}x${height}`, ...facts });
        await page.screenshot({ path: path.join(output, `${width}x${height}.png`) });
        await revealPage(page);
        await page.screenshot({ path: path.join(output, `${width}x${height}-full.png`), fullPage: true });
        const afterScroll = await pageFacts(page);
        report.viewports.at(-1).afterScroll = { transferBytes: afterScroll.transferBytes, encodedBodyBytes: afterScroll.encodedBodyBytes,
          resources: afterScroll.resources, metrics: afterScroll.metrics };
        assert.ok(facts.scrollWidth <= facts.width + 1, `overflow ${facts.scrollWidth}/${facts.width}`);
        assert.deepEqual(facts.clippedText, [], 'Texto ultrapassa o viewport mesmo sem barra de rolagem horizontal.');
        assert.equal(facts.h1.length, 1, 'A página precisa de um h1.');
        assert.ok(facts.lang.startsWith('pt'), 'Idioma português ausente.');
        assert.deepEqual(facts.links.filter(link => !link.valid), [], 'Âncoras inválidas.');
        if ([1440,390].includes(width)) await audit(page, `${width}x${height}`);
        return { title: facts.title, overflow: facts.scrollWidth - facts.width };
      } finally { await page.context().close(); }
    })();
  }
  if (!baseline) await exerciseSite();
  await check('console e recursos HTTP', async () => {
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.requestsFailed, []);
    assert.deepEqual(report.responsesFailed, []);
  })();
} finally {
  report.finishedAt = new Date().toISOString();
  report.sourceHashAfter = await publicSourceHash();
  report.changedDuringRun = report.sourceHash !== report.sourceHashAfter;
  report.passed = !report.changedDuringRun && report.checks.every(item => item.passed);
  await writeFile(path.join(root, 'reports', `website-${label}.json`), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
}
console.log(`Relatório: reports/website-${label}.json`);
if (!report.passed) process.exitCode = 1;
