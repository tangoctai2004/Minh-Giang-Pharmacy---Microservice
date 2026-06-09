#!/usr/bin/env node

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DIRS = {
  data: path.join(ROOT, 'data'),
  logs: path.join(ROOT, 'logs'),
  raw: path.join(ROOT, 'raw'),
  state: path.join(ROOT, 'state'),
  assets: path.join(ROOT, 'assets'),
  reports: path.join(ROOT, 'reports'),
};

const DEFAULT_CONFIG_PATH = path.join(ROOT, 'config.example.json');
const LOCAL_CONFIG_PATH = path.join(ROOT, 'config.local.json');
const DEFAULT_CATEGORY_MAP_PATH = path.join(ROOT, 'category-map.example.json');
const LOCAL_CATEGORY_MAP_PATH = path.join(ROOT, 'category-map.local.json');

const STATE_FILES = {
  products: path.join(DIRS.state, 'product-urls.json'),
  articles: path.join(DIRS.state, 'article-urls.json'),
  diseases: path.join(DIRS.state, 'disease-urls.json'),
};

const DATA_FILES = {
  products: path.join(DIRS.data, 'products.jsonl'),
  articles: path.join(DIRS.data, 'articles.jsonl'),
  diseases: path.join(DIRS.data, 'diseases.jsonl'),
};

let stopRequested = false;
let adaptiveMinDelay = null;
let adaptiveMaxDelay = null;
let consecutiveSuccesses = 0;

process.on('SIGINT', () => {
  stopRequested = true;
  log('warn', 'Stop requested by SIGINT. Finishing current item then saving state.');
});

process.on('SIGTERM', () => {
  stopRequested = true;
  log('warn', 'Stop requested by SIGTERM. Finishing current item then saving state.');
});

function nowIso() {
  return new Date().toISOString();
}

function log(level, message, extra = null) {
  let displayMsg = message;
  const kindMap = { products: 'sản phẩm', articles: 'bài viết', diseases: 'bệnh lý', all: 'tất cả' };

  if (level === 'info') {
    if (message.startsWith('GET ')) {
      if (message.startsWith('GET image ')) {
        displayMsg = `[ẢNH] Đang tải: ${message.substring(10)}`;
      } else {
        const url = message.substring(4);
        const attempt = extra?.attempt || 1;
        displayMsg = `[TẢI] Lần ${attempt} | ${url}`;
      }
    } else if (message.startsWith('Saved ')) {
      const parts = message.split(' ');
      const kind = parts[1];
      const kindName = kindMap[kind] || 'mục';
      displayMsg = `[THÀNH CÔNG] Đã lưu ${kindName} #${extra?.count}: "${extra?.title}"`;
    } else if (message === 'Polite delay before next request.') {
      displayMsg = `[NGHỈ] Chờ ${(extra?.delayMs / 1000).toFixed(1)}s (Độ trễ cơ sở: ${(extra?.currentMin / 1000).toFixed(1)}s)`;
    } else if (message === 'Optimizing delay speed (adaptive speedup)') {
      displayMsg = `[TĂNG TỐC] Độ trễ tối ưu xuống: ${(extra?.min / 1000).toFixed(1)}s - ${(extra?.max / 1000).toFixed(1)}s`;
    } else if (message === 'Discovery completed.') {
      displayMsg = `[TÌM THẤY] Quét sitemap xong | Sản phẩm: ${extra?.products}, Bài viết: ${extra?.articles}, Bệnh lý: ${extra?.diseases}`;
    } else if (message.startsWith('Crawl ')) {
      const parts = message.split(' ');
      const kind = parts[1];
      const kindName = kindMap[kind] || kind;
      displayMsg = `[HOÀN THÀNH] Đợt cào ${kindName} hoàn tất. Đã lưu thêm: ${extra?.completedThisRun}`;
    } else if (message.startsWith('Reset state for ')) {
      const parts = message.split(' ');
      const kind = parts[3];
      const kindName = kindMap[kind] || kind;
      displayMsg = `[RESET] Đã làm mới trạng thái cho ${kindName}. Tổng số URL: ${extra?.urls}`;
    } else if (message === 'Quality report written.') {
      displayMsg = `[BÁO CÁO] Đã xuất báo cáo chất lượng: ${extra?.reportPath}`;
    }
  } else if (level === 'warn') {
    if (message.startsWith('Stop requested by ')) {
      displayMsg = `[DỪNG] Đã nhận tín hiệu tắt. Đang hoàn thành mục cuối và lưu trạng thái...`;
    } else if (message === 'Server returned 429. Cooling down before retry.') {
      displayMsg = `[BỊ CHẶN 429] Yêu cầu quá nhanh. Tạm nghỉ ${(extra?.cooldownMs / 60000).toFixed(1)} phút để hạ nhiệt...`;
    } else if (message === 'Increased adaptive delay due to 429.') {
      displayMsg = `[CẢNH BÁO] Tăng độ trễ cơ sở lên: ${(extra?.min / 1000).toFixed(1)}s - ${(extra?.max / 1000).toFixed(1)}s do bị chặn 429`;
    } else if (message === 'Server returned 5xx. Cooling down before retry.') {
      displayMsg = `[LỖI SERVER 5xx] Lỗi máy chủ đối tác. Tạm nghỉ ${(extra?.cooldownMs / 1000).toFixed(1)}s...`;
    } else if (message === 'Request failed with non-retryable status.') {
      displayMsg = `[BỎ QUA] Lỗi 404/410 (Không tồn tại) | ${extra?.url}`;
    } else if (message === 'Request failed.') {
      displayMsg = `[THỬ LẠI] Yêu cầu thất bại (Lần ${extra?.attempt}) | Lỗi: ${extra?.error} | ${extra?.url}`;
    } else if (message === 'Slowing down crawler due to error (adaptive backoff)') {
      displayMsg = `[GIẢM TỐC] Tăng độ trễ lên: ${(extra?.min / 1000).toFixed(1)}s - ${(extra?.max / 1000).toFixed(1)}s`;
    } else if (message.startsWith('No ')) {
      const parts = message.split(' ');
      const kind = parts[1];
      const kindName = kindMap[kind] || kind;
      displayMsg = `[CẢNH BÁO] Chưa có URL ${kindName} nào. Hãy chạy lệnh discover trước.`;
    } else if (message === 'Image download failed; keeping live URL.') {
      displayMsg = `[LỖI TẢI ẢNH] Giữ lại link gốc. Lỗi: ${extra?.error} | ${extra?.imageUrl}`;
    }
  } else if (level === 'error') {
    if (message.startsWith('Failed ')) {
      displayMsg = `[THẤT BẠI] Lỗi cào: ${extra?.url} | ${extra?.error}`;
    } else if (message === 'Stopping because too many consecutive errors occurred.') {
      displayMsg = `[DỪNG KHẨN CẤP] Tự động dừng do lỗi liên tiếp quá giới hạn (${extra?.consecutiveErrors} lần)`;
    }
  }

  // Format local time for console
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const consoleLine = `[${timeStr}] [${level.toUpperCase()}] ${displayMsg}`;
  console.log(consoleLine);

  // Write original raw message to file
  const fileLine = `[${nowIso()}] [${level.toUpperCase()}] ${message}${extra ? ` ${JSON.stringify(extra)}` : ''}`;
  try {
    fs.mkdirSync(DIRS.logs, { recursive: true });
    fs.appendFileSync(path.join(DIRS.logs, 'crawler.log'), `${fileLine}\n`, 'utf8');
  } catch {
    // Do not fail crawling because logging failed.
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  argv.forEach((arg) => {
    if (!arg.startsWith('--')) {
      positional.push(arg);
      return;
    }
    const [key, rawValue] = arg.slice(2).split('=');
    flags[key] = rawValue === undefined ? true : rawValue;
  });
  return { positional, flags };
}

async function ensureDirs() {
  await Promise.all([
    fsp.mkdir(DIRS.data, { recursive: true }),
    fsp.mkdir(DIRS.logs, { recursive: true }),
    fsp.mkdir(DIRS.raw, { recursive: true }),
    fsp.mkdir(DIRS.state, { recursive: true }),
    fsp.mkdir(DIRS.assets, { recursive: true }),
    fsp.mkdir(DIRS.reports, { recursive: true }),
    fsp.mkdir(path.join(DIRS.raw, 'products'), { recursive: true }),
    fsp.mkdir(path.join(DIRS.raw, 'articles'), { recursive: true }),
    fsp.mkdir(path.join(DIRS.raw, 'diseases'), { recursive: true }),
    fsp.mkdir(path.join(DIRS.assets, 'images', 'products'), { recursive: true }),
    fsp.mkdir(path.join(DIRS.assets, 'images', 'articles'), { recursive: true }),
    fsp.mkdir(path.join(DIRS.assets, 'images', 'diseases'), { recursive: true }),
  ]);
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, value) {
  const tmpPath = `${filePath}.tmp`;
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(tmpPath, filePath);
}

function mergeDeep(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(out[key] || {}, value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

async function loadConfig() {
  const base = await readJson(DEFAULT_CONFIG_PATH, {});
  const local = await readJson(LOCAL_CONFIG_PATH, {});
  return mergeDeep(base, local);
}

async function loadCategoryMap() {
  const base = await readJson(DEFAULT_CATEGORY_MAP_PATH, {});
  const local = await readJson(LOCAL_CATEGORY_MAP_PATH, {});
  return mergeDeep(base, local);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  const lo = Number(min) || 0;
  const hi = Number(max) || lo;
  if (hi <= lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function normalizeUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString().replace(/\/+$/, '/');
  } catch {
    return '';
  }
}

function pathnameOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

function htmlDecode(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value = '') {
  return htmlDecode(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHtml(value = '') {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function firstMatch(text, regex) {
  const match = String(text || '').match(regex);
  return match ? htmlDecode(match[1]).trim() : '';
}

function allMatches(text, regex) {
  const output = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    output.push(htmlDecode(match[1]).trim());
  }
  return output;
}

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stableDigits(input, length) {
  const hex = crypto.createHash('sha1').update(String(input || '')).digest('hex');
  let digits = '';
  for (let i = 0; digits.length < length; i += 8) {
    const chunk = hex.slice(i, i + 8) || hex;
    digits += String(parseInt(chunk, 16));
  }
  return digits.slice(0, length);
}

function priceToNumber(value = '') {
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

function compactKey(value = '') {
  return slugify(value).replace(/-+/g, '-');
}

function allowedPrefixesForKind(kind, config) {
  if (kind === 'products') return config.urlPatterns?.productPrefixes || [];
  if (kind === 'articles') return config.urlPatterns?.articlePrefixes || [];
  if (kind === 'diseases') return config.urlPatterns?.diseasePrefixes || [];
  return [];
}

function isAllowedKindUrl(kind, url, config) {
  const prefixes = allowedPrefixesForKind(kind, config);
  const pathname = pathnameOf(url);
  return prefixes.length === 0 || prefixes.some((prefix) => pathname.startsWith(prefix));
}

async function requestText(url, config, context) {
  const requestConfig = config.request || {};
  let attempt = 0;
  let lastError = '';

  while (attempt <= Number(requestConfig.maxRetries || 0)) {
    if (stopRequested) throw new Error('Stop requested');
    attempt += 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(requestConfig.timeoutMs || 30000));

    try {
      log('info', `GET ${url}`, { context, attempt });
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': requestConfig.userAgent || 'Mozilla/5.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.6',
        },
      });
      clearTimeout(timeout);

      if (response.status === 429) {
        lastError = 'HTTP 429 Too Many Requests';
        log('warn', 'Server returned 429. Cooling down before retry.', {
          url,
          cooldownMs: requestConfig.cooldownOn429Ms,
        });
        if (adaptiveMinDelay !== null) {
          const maxAllowedMin = Number(requestConfig.maxBackoffMinDelayMs || 15000);
          adaptiveMinDelay = Math.min(maxAllowedMin, Math.round(adaptiveMinDelay * 2.0));
          adaptiveMaxDelay = Math.min(maxAllowedMin + 5000, Math.round(adaptiveMaxDelay * 2.0));
          log('warn', 'Increased adaptive delay due to 429.', { min: adaptiveMinDelay, max: adaptiveMaxDelay });
        }
        await sleep(Number(requestConfig.cooldownOn429Ms || 900000));
        continue;
      }

      if (response.status >= 500) {
        lastError = `HTTP ${response.status}`;
        log('warn', 'Server returned 5xx. Cooling down before retry.', {
          url,
          status: response.status,
          cooldownMs: requestConfig.cooldownOn5xxMs,
        });
        await sleep(Number(requestConfig.cooldownOn5xxMs || 180000));
        continue;
      }

      if (response.status === 404 || response.status === 410) {
        const error = new Error(`HTTP ${response.status}`);
        error.nonRetryable = true;
        throw error;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeout);
      lastError = error.message || String(error);
      if (error.nonRetryable) {
        log('warn', 'Request failed with non-retryable status.', { url, error: lastError });
        throw error;
      }
      log('warn', 'Request failed.', { url, attempt, error: lastError });
      const retryDelay = randomBetween(requestConfig.minDelayMs, requestConfig.maxDelayMs);
      await sleep(retryDelay);
    }
  }

  throw new Error(lastError || 'Request failed after retries');
}

async function requestBinary(url, config, context) {
  const requestConfig = config.request || {};
  const imageTimeoutMs = Number(config.storage?.imageTimeoutMs || requestConfig.timeoutMs || 30000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), imageTimeoutMs);

  try {
    log('info', `GET image ${url}`, { context });
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': requestConfig.userAgent || 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.6',
        'Referer': config.baseUrl,
      },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const allowed = config.storage?.allowedImageTypes || [];
    if (allowed.length && !allowed.includes(contentType)) {
      throw new Error(`Unsupported image type: ${contentType || 'unknown'}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function politeDelay(config) {
  if (adaptiveMinDelay === null) {
    adaptiveMinDelay = Number(config.request?.minDelayMs || 2000);
    adaptiveMaxDelay = Number(config.request?.maxDelayMs || 5000);
  }
  const delayMs = randomBetween(adaptiveMinDelay, adaptiveMaxDelay);
  log('info', 'Polite delay before next request.', { delayMs, currentMin: adaptiveMinDelay });
  await sleep(delayMs);
}

async function discover(config) {
  await ensureDirs();
  const sitemap = await requestText(config.sitemapUrl, config, 'sitemap');
  await fsp.writeFile(path.join(DIRS.state, 'sitemap.xml'), sitemap, 'utf8');

  const locs = allMatches(sitemap, /<loc>([^<]+)<\/loc>/g)
    .map((url) => normalizeUrl(url, config.baseUrl))
    .filter(Boolean);

  const classify = (prefixes) => locs.filter((url) => {
    const pathname = pathnameOf(url);
    return prefixes.some((prefix) => pathname.startsWith(prefix)) && pathname.endsWith('/');
  });

  const productUrls = classify(config.urlPatterns.productPrefixes || []);
  const articleUrls = classify(config.urlPatterns.articlePrefixes || []);
  const diseaseUrls = classify(config.urlPatterns.diseasePrefixes || []);

  await mergeDiscoveredUrls('products', productUrls);
  await mergeDiscoveredUrls('articles', articleUrls);
  await mergeDiscoveredUrls('diseases', diseaseUrls);

  log('info', 'Discovery completed.', {
    products: productUrls.length,
    articles: articleUrls.length,
    diseases: diseaseUrls.length,
  });
}

async function mergeDiscoveredUrls(kind, urls) {
  const state = await readJson(STATE_FILES[kind], []);
  const byUrl = new Map(state.map((item) => [item.url, item]));
  urls.forEach((url, index) => {
    if (!byUrl.has(url)) {
      byUrl.set(url, {
        url,
        status: 'pending',
        attempts: 0,
        discovered_at: nowIso(),
        sort_order: byUrl.size + index,
      });
    }
  });
  await writeJsonAtomic(STATE_FILES[kind], [...byUrl.values()]);
}

async function appendJsonl(filePath, record) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function readJsonl(filePath) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return raw.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function readDoneUrls(kind) {
  const filePath = DATA_FILES[kind];
  const urls = new Set();
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    raw.split('\n').forEach((line) => {
      if (!line.trim()) return;
      try {
        const item = JSON.parse(line);
        if (item.source_url) urls.add(item.source_url);
      } catch {
        // Ignore damaged line; state still protects most progress.
      }
    });
  } catch {
    // No data yet.
  }
  return urls;
}

async function crawl(kind, config, flags) {
  await ensureDirs();
  if (!['products', 'articles', 'diseases', 'all'].includes(kind)) {
    throw new Error(`Unknown crawl kind: ${kind}`);
  }
  if (kind === 'all') {
    await crawl('products', config, flags);
    if (!stopRequested) await crawl('articles', config, flags);
    if (!stopRequested) await crawl('diseases', config, flags);
    return;
  }

  const limit = Number(flags.limit || config.limits?.[kind] || 0);
  const statePath = STATE_FILES[kind];
  const state = await readJson(statePath, []);
  if (!state.length) {
    log('warn', `No ${kind} URLs found. Run discover first.`);
    return;
  }

  const doneUrls = await readDoneUrls(kind);
  let completedThisRun = 0;
  let consecutiveErrors = 0;
  const parser = kind === 'products' ? parseProduct : parseArticle;
  const categoryMap = await loadCategoryMap();

  for (const item of state) {
    let shouldDelayAfterItem = true;
    if (stopRequested) break;
    if (limit > 0 && completedThisRun >= limit) break;
    if (item.status === 'done' || doneUrls.has(item.url)) {
      item.status = 'done';
      continue;
    }
    if (item.status === 'skipped') {
      continue;
    }
    if (item.status === 'failed' && !flags.retryFailed && flags['retry-failed'] !== 'true') {
      continue;
    }
    if (!isAllowedKindUrl(kind, item.url, config)) {
      item.status = 'skipped';
      item.last_error = 'URL no longer matches configured prefixes';
      item.skipped_at = nowIso();
      continue;
    }

    item.status = 'in_progress';
    item.started_at = nowIso();
    await writeJsonAtomic(statePath, state);

    try {
      const html = await requestText(item.url, config, kind);
      if (config.storage?.saveRawHtml) {
        await saveRawHtml(kind, item.url, html, Number(config.storage.rawHtmlMaxBytes || 800000));
      }
      let parsed = parser(item.url, html, config, kind);
      if (!parsed || !parsed.title && !parsed.name) {
        throw new Error('Parser returned empty record');
      }
      parsed = enrichRecord(kind, parsed, config, categoryMap);

      if (config.storage?.downloadImages) {
        parsed = await downloadRecordImages(kind, parsed, config);
      }

      await appendJsonl(DATA_FILES[kind], parsed);
      item.status = 'done';
      item.finished_at = nowIso();
      item.last_error = null;
      item.attempts = Number(item.attempts || 0) + 1;
      completedThisRun += 1;
      consecutiveErrors = 0;
      log('info', `Saved ${kind} item.`, {
        count: completedThisRun,
        title: parsed.name || parsed.title,
      });

      // Adaptive speedup on success
      consecutiveSuccesses += 1;
      if (consecutiveSuccesses >= 10) {
        const minAllowed = Number(config.request?.absoluteMinDelayMs || 1000);
        if (adaptiveMinDelay > minAllowed) {
          adaptiveMinDelay = Math.max(minAllowed, Math.round(adaptiveMinDelay * 0.85));
          adaptiveMaxDelay = Math.max(minAllowed + 1000, Math.round(adaptiveMaxDelay * 0.85));
          log('info', 'Optimizing delay speed (adaptive speedup)', { min: adaptiveMinDelay, max: adaptiveMaxDelay });
        }
        consecutiveSuccesses = 0;
      }
    } catch (error) {
      item.status = error.nonRetryable ? 'skipped' : 'failed';
      item.last_error = error.message || String(error);
      item.failed_at = nowIso();
      item.attempts = Number(item.attempts || 0) + 1;
      consecutiveErrors = error.nonRetryable ? 0 : consecutiveErrors + 1;
      shouldDelayAfterItem = true;
      log('error', `Failed ${kind} item.`, { url: item.url, error: item.last_error });

      // Adaptive backoff on retryable errors
      consecutiveSuccesses = 0;
      if (!error.nonRetryable && adaptiveMinDelay !== null) {
        const maxAllowedMin = Number(config.request?.maxBackoffMinDelayMs || 15000);
        adaptiveMinDelay = Math.min(maxAllowedMin, Math.round(adaptiveMinDelay * 1.5));
        adaptiveMaxDelay = Math.min(maxAllowedMin + 5000, Math.round(adaptiveMaxDelay * 1.5));
        log('warn', 'Slowing down crawler due to error (adaptive backoff)', { min: adaptiveMinDelay, max: adaptiveMaxDelay });
      }

      if (consecutiveErrors >= Number(config.request?.stopAfterConsecutiveErrors || 8)) {
        log('error', 'Stopping because too many consecutive errors occurred.', { consecutiveErrors });
        break;
      }
    }

    await writeJsonAtomic(statePath, state);
    if (!stopRequested && shouldDelayAfterItem) await politeDelay(config);
  }

  await writeJsonAtomic(statePath, state);
  log('info', `Crawl ${kind} finished or paused.`, { completedThisRun });
}

function enrichRecord(kind, record, config, categoryMap) {
  const mappedCategory = mapCategory(kind, record, categoryMap);
  const mappedRecord = { ...record, mapped_category: mappedCategory };
  const quality = kind === 'products'
    ? scoreProductQuality(mappedRecord, config)
    : scoreArticleQuality(mappedRecord, config);
  return {
    ...mappedRecord,
    quality_score: quality.score,
    quality_status: quality.status,
    quality_issues: quality.issues,
  };
}

function mapCategory(kind, record, categoryMap) {
  const rules = kind === 'products'
    ? categoryMap.productCategoryRules || []
    : categoryMap.articleCategoryRules || [];
  const haystack = compactKey([
    record.name,
    record.title,
    record.source_url,
    record.source_type,
    ...(record.category_path || []),
    ...(record.tags || []),
  ].filter(Boolean).join(' '));

  for (const rule of rules) {
    const matchedBy = (rule.matchAny || []).find((keyword) => haystack.includes(compactKey(keyword)));
    if (matchedBy) {
      return {
        slug: rule.mapped_category_slug,
        name: rule.mapped_category_name,
        matched_by: matchedBy,
      };
    }
  }
  return {
    slug: null,
    name: null,
    matched_by: null,
  };
}

function scoreProductQuality(record, config) {
  const issues = [];
  const minDescriptionLength = Number(config.quality?.minDescriptionLength || 180);
  const isMedicine = isLikelyMedicine(record);

  if (!record.name) issues.push('missing_name');
  if (!record.retail_price || record.retail_price <= 0) issues.push('missing_or_invalid_price');
  if (!record.image_url && !(record.gallery || []).length) issues.push('missing_image');
  if (!record.category_path || record.category_path.length === 0) issues.push('missing_category_path');
  if (!record.mapped_category?.slug) issues.push('missing_mapped_category');
  if (!record.description || record.description.length < minDescriptionLength) issues.push('description_too_short');
  if (!record.base_unit) issues.push('missing_base_unit');
  if (!record.brand && !record.manufacturer) issues.push('missing_brand_or_manufacturer');

  if (isMedicine) {
    if (!record.active_ingredient) issues.push('medicine_missing_active_ingredient');
    if (!record.registration_number) issues.push('medicine_missing_registration_number');
  }

  const possible = isMedicine ? 10 : 8;
  const score = Math.max(0, Math.round(((possible - issues.length) / possible) * 100));
  const cleanThreshold = Number(config.quality?.minProductScoreForClean || 70);
  const status = score >= cleanThreshold && !issues.includes('missing_name') && !issues.includes('missing_mapped_category')
    ? 'clean'
    : score >= 45 ? 'needs_review' : 'reject';
  return { score, status, issues };
}

function scoreArticleQuality(record, config) {
  const issues = [];
  const minLength = Number(config.quality?.minArticleTextLength || 700);
  if (!record.title) issues.push('missing_title');
  if (!record.thumbnail_url) issues.push('missing_thumbnail');
  if (!record.content_sanitized || Number(record.text_length || 0) < minLength) issues.push('content_too_short');
  if (!record.mapped_category?.slug) issues.push('missing_mapped_category');
  if (record.source_type === 'tin-tuc-va-su-kien') issues.push('non_health_news_or_promotion');
  const possible = 5;
  const score = Math.max(0, Math.round(((possible - issues.length) / possible) * 100));
  const status = issues.includes('non_health_news_or_promotion')
    ? 'reject'
    : score >= 75 ? 'clean' : score >= 50 ? 'needs_review' : 'reject';
  return { score, status, issues };
}

function isLikelyMedicine(record) {
  const text = compactKey([
    record.name,
    record.source_url,
    ...(record.category_path || []),
    record.mapped_category?.slug,
  ].filter(Boolean).join(' '));
  return text.includes('thuoc') || Boolean(record.requires_prescription);
}

async function downloadRecordImages(kind, record, config) {
  const imageUrls = kind === 'products'
    ? [record.image_url, ...(record.gallery || [])].filter(Boolean)
    : [record.thumbnail_url].filter(Boolean);
  const uniqueUrls = [...new Set(imageUrls)];
  const maxImages = kind === 'products'
    ? Number(config.storage?.maxImagesPerProduct || 5)
    : Number(config.storage?.maxImagesPerArticle || 1);
  const downloaded = [];

  for (const imageUrl of uniqueUrls.slice(0, maxImages)) {
    try {
      const saved = await downloadImage(kind, record, imageUrl, config);
      downloaded.push(saved);
      await politeDelay(config);
    } catch (error) {
      log('warn', 'Image download failed; keeping live URL.', { imageUrl, error: error.message });
    }
  }

  if (!downloaded.length) return record;

  const localPrimary = downloaded[0].relative_path;
  if (kind === 'products') {
    return {
      ...record,
      image_url_live: record.image_url,
      gallery_live: record.gallery,
      image_url: localPrimary,
      gallery: downloaded.map((item) => item.relative_path),
      downloaded_images: downloaded,
    };
  }

  return {
    ...record,
    thumbnail_url_live: record.thumbnail_url,
    thumbnail_url: localPrimary,
    downloaded_images: downloaded,
  };
}

async function downloadImage(kind, record, imageUrl, config) {
  const { buffer, contentType } = await requestBinary(imageUrl, config, kind);
  const extByType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const ext = extByType[contentType] || path.extname(new URL(imageUrl).pathname).replace('.', '') || 'img';
  const hash = crypto.createHash('sha1').update(imageUrl).digest('hex').slice(0, 14);
  const baseSlug = slugify(record.slug || record.name || record.title || kind).slice(0, 80) || kind;
  const dirName = kind === 'products' ? 'products' : kind;
  const fileName = `${baseSlug}-${hash}.${ext}`;
  const absolutePath = path.join(DIRS.assets, 'images', dirName, fileName);
  const relativePath = path.relative(ROOT, absolutePath).replace(/\\/g, '/');
  await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsp.writeFile(absolutePath, buffer);
  return {
    source_url: imageUrl,
    relative_path: relativePath,
    content_type: contentType,
    bytes: buffer.length,
  };
}

async function saveRawHtml(kind, url, html, maxBytes) {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  const rawDir = path.join(DIRS.raw, kind);
  await fsp.mkdir(rawDir, { recursive: true });
  const sliced = Buffer.from(html, 'utf8').subarray(0, maxBytes).toString('utf8');
  await fsp.writeFile(path.join(rawDir, `${hash}.html`), sliced, 'utf8');
}

function parseProduct(url, html, config) {
  const title = stripTags(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i))
    .replace(/\s*[-|]\s*Trung Sơn.*$/i, '')
    .trim();
  const h1 = stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const name = h1 || title;
  const ogImage = firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const priceText = firstMatch(html, /class=["'][^"']*ty-price-num[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    || firstMatch(html, /([0-9][0-9.,\s]+đ)/i);
  const descriptionHtml = firstMatch(html, /id=["']content_description["'][^>]*>([\s\S]*?)(?:<div\s+id=["']content_|<\/section>|<\/article>|$)/i)
    || firstMatch(html, /class=["'][^"']*ty-wysiwyg-content[^"']*["'][^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>|$)/i);
  const description = stripTags(descriptionHtml).slice(0, 8000);
  const specText = stripTags(html);
  const categoryPath = allMatches(html, /class=["'][^"']*ty-breadcrumbs__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)
    .map(stripTags)
    .filter(Boolean);

  const gallery = [...new Set([
    normalizeUrl(ogImage, config.baseUrl),
    ...allMatches(html, /(?:href|src)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)
      .filter((imageUrl) => /\/images\/|\/storage\/|cdn\.trungsoncare/i.test(imageUrl))
      .map((imageUrl) => normalizeUrl(imageUrl, config.baseUrl)),
  ].filter(Boolean))].slice(0, 10);

  return {
    source: 'trungsoncare',
    source_url: normalizeUrl(url, config.baseUrl),
    crawled_at: nowIso(),
    sku_suggested: `TS-${stableDigits(url, 8)}`,
    barcode_suggested: `893${stableDigits(`${url}:barcode`, 10)}`,
    name,
    slug: slugify(name || pathnameOf(url).split('/').filter(Boolean).pop()),
    category_path: categoryPath,
    retail_price: priceToNumber(priceText),
    image_url: gallery[0] || null,
    gallery,
    brand: pickLabeledValue(specText, ['Thương hiệu']),
    base_unit: pickLabeledValue(specText, ['Đơn vị tính']) || inferBaseUnit(name),
    packaging: pickLabeledValue(specText, ['Quy cách']),
    registration_number: pickLabeledValue(specText, ['Số đăng ký', 'Số công bố']),
    manufacturer: pickLabeledValue(specText, ['Nhà sản xuất', 'Thương hiệu']),
    active_ingredient: pickSection(description, ['Thành phần'], ['Công dụng', 'Cách dùng', 'Đối tượng', 'Lưu ý']),
    description,
    sections: {
      ingredients: pickSection(description, ['Thành phần'], ['Công dụng', 'Cách dùng', 'Đối tượng', 'Lưu ý']),
      usage: pickSection(description, ['Cách dùng', 'Hướng dẫn sử dụng'], ['Đối tượng', 'Tác dụng phụ', 'Lưu ý', 'Bảo quản']),
      indications: pickSection(description, ['Công dụng', 'Chỉ định'], ['Cách dùng', 'Đối tượng', 'Tác dụng phụ', 'Lưu ý']),
      warnings: pickSection(description, ['Lưu ý', 'Thận trọng'], ['Bảo quản', 'Thông tin']),
      storage: pickSection(description, ['Bảo quản'], ['Thông tin', 'Quy cách']),
    },
    requires_prescription: /kê đơn|thuốc bán theo đơn|\brx\b/i.test(`${name} ${description}`),
    raw_quality: qualityFlags({ name, priceText, gallery, description }),
  };
}

function parseArticle(url, html, config, kind) {
  const title = stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i))
    || stripTags(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)).replace(/\s*[-|]\s*Trung Sơn.*$/i, '');
  const thumbnail = normalizeUrl(
    firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i),
    config.baseUrl
  ) || null;
  const contentRaw = firstMatch(html, /class=["'][^"']*ty-wysiwyg-content[^"']*["'][^>]*>([\s\S]*?)(?:<\/main>|<footer|$)/i)
    || firstMatch(html, /<article[^>]*>([\s\S]*?)<\/article>/i);
  const contentSanitized = cleanHtml(contentRaw);
  const plain = stripTags(contentSanitized);
  const pathnameParts = pathnameOf(url).split('/').filter(Boolean);
  const sourceType = pathnameParts[0] || kind;

  return {
    source: 'trungsoncare',
    source_url: normalizeUrl(url, config.baseUrl),
    crawled_at: nowIso(),
    type: kind === 'diseases' ? 'disease' : 'article',
    source_type: sourceType,
    title,
    slug: slugify(pathnameParts[pathnameParts.length - 1] || title),
    thumbnail_url: thumbnail,
    excerpt: plain.slice(0, 300),
    content_sanitized: contentSanitized,
    text_length: plain.length,
    tags: [...new Set([sourceType, kind === 'diseases' ? 'benh-ly' : 'suc-khoe', 'tu-van'])],
    raw_quality: {
      has_title: Boolean(title),
      has_thumbnail: Boolean(thumbnail),
      has_content: plain.length >= 500,
    },
  };
}

function pickLabeledValue(text, labels) {
  const normalized = String(text || '').replace(/\s+/g, ' ');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalized.match(new RegExp(`${escaped}\\s*:?\\s*(.{1,180}?)(?=\\s+[A-ZÀ-Ỵa-zà-ỵ ]{2,30}\\s*:|$)`, 'i'));
    if (match) return match[1].trim();
  }
  return '';
}

function pickSection(text, startLabels, endLabels) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  for (const start of startLabels) {
    const startIndex = normalized.toLowerCase().indexOf(start.toLowerCase());
    if (startIndex < 0) continue;
    let endIndex = normalized.length;
    for (const end of endLabels) {
      const candidate = normalized.toLowerCase().indexOf(end.toLowerCase(), startIndex + start.length);
      if (candidate > startIndex && candidate < endIndex) endIndex = candidate;
    }
    return normalized.slice(startIndex + start.length, endIndex).replace(/^[:\s-]+/, '').trim().slice(0, 2000);
  }
  return '';
}

function inferBaseUnit(name = '') {
  const match = String(name).match(/\b(Hộp|Chai|Tuýp|Tube|Vỉ|Viên|Gói|Lọ|Ống|Bịch|Túi|Hũ)\b/i);
  return match ? match[1] : '';
}

function qualityFlags({ name, priceText, gallery, description }) {
  return {
    has_name: Boolean(name),
    has_price: Boolean(priceToNumber(priceText)),
    has_image: Array.isArray(gallery) && gallery.length > 0,
    has_description: String(description || '').length >= 120,
  };
}

async function status() {
  await ensureDirs();
  const result = {};
  for (const kind of ['products', 'articles', 'diseases']) {
    const state = await readJson(STATE_FILES[kind], []);
    const counts = state.reduce((acc, item) => {
      acc[item.status || 'unknown'] = (acc[item.status || 'unknown'] || 0) + 1;
      return acc;
    }, {});
    let dataRows = 0;
    try {
      const raw = await fsp.readFile(DATA_FILES[kind], 'utf8');
      dataRows = raw.split('\n').filter((line) => line.trim()).length;
    } catch {
      dataRows = 0;
    }
    result[kind] = { urls: state.length, dataRows, counts };
  }
  console.log(JSON.stringify(result, null, 2));
}

async function validate(kind = 'all') {
  await ensureDirs();
  const config = await loadConfig();
  const categoryMap = await loadCategoryMap();
  const kinds = kind === 'all' ? ['products', 'articles', 'diseases'] : [kind];
  const report = {
    generated_at: nowIso(),
    datasets: {},
  };

  for (const currentKind of kinds) {
    if (!DATA_FILES[currentKind]) throw new Error(`Unknown validate kind: ${currentKind}`);
    const rows = (await readJsonl(DATA_FILES[currentKind]))
      .map((row) => enrichRecord(currentKind, row, config, categoryMap));
    const byStatus = {};
    const issueCounts = {};
    const duplicateSourceUrls = [];
    const seenUrls = new Set();
    let scoreSum = 0;

    rows.forEach((row) => {
      byStatus[row.quality_status || 'unknown'] = (byStatus[row.quality_status || 'unknown'] || 0) + 1;
      scoreSum += Number(row.quality_score || 0);
      (row.quality_issues || []).forEach((issue) => {
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
      });
      if (row.source_url) {
        if (seenUrls.has(row.source_url)) duplicateSourceUrls.push(row.source_url);
        seenUrls.add(row.source_url);
      }
    });

    report.datasets[currentKind] = {
      total: rows.length,
      average_quality_score: rows.length ? Math.round(scoreSum / rows.length) : 0,
      by_status: byStatus,
      issue_counts: issueCounts,
      duplicate_source_url_count: duplicateSourceUrls.length,
      duplicate_source_urls: duplicateSourceUrls.slice(0, 100),
      sample_rejects: rows
        .filter((row) => row.quality_status === 'reject')
        .slice(0, 20)
        .map((row) => ({
          title: row.name || row.title,
          source_url: row.source_url,
          quality_score: row.quality_score,
          quality_issues: row.quality_issues,
        })),
    };
  }

  const reportPath = path.join(DIRS.reports, `quality-report-${kind}-${Date.now()}.json`);
  await writeJsonAtomic(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
  log('info', 'Quality report written.', { reportPath });
}

async function reset(kind) {
  if (!['products', 'articles', 'diseases'].includes(kind)) {
    throw new Error('Reset requires one of: products, articles, diseases');
  }
  const state = await readJson(STATE_FILES[kind], []);
  state.forEach((item) => {
    item.status = 'pending';
    item.attempts = 0;
    item.last_error = null;
    delete item.started_at;
    delete item.finished_at;
    delete item.failed_at;
  });
  await writeJsonAtomic(STATE_FILES[kind], state);
  log('info', `Reset state for ${kind}. Data file is not deleted.`, { urls: state.length });
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0] || 'status';
  const arg = positional[1] || '';
  const config = await loadConfig();

  if (command === 'discover') return discover(config);
  if (command === 'crawl') return crawl(arg || 'all', config, flags);
  if (command === 'status') return status();
  if (command === 'reset') return reset(arg);
  if (command === 'validate' || command === 'report') return validate(arg || 'all');

  console.log(`Unknown command: ${command}`);
  console.log('Usage: node index.js discover | crawl products|articles|diseases|all [--limit=100] | status | validate products|articles|diseases|all | reset products|articles|diseases');
}

main().catch((error) => {
  log('error', error.message || String(error));
  process.exitCode = 1;
});
