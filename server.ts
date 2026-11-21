import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT_DIR = process.cwd();
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIP(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }
    if (lower.startsWith('ff')) return true;
    if (lower.startsWith('::ffff:')) {
      const mapped = lower.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateIPv4(mapped);
    }
    return false;
  }
  return true;
}

async function validateExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Blocked host');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error('Blocked IP');
    return parsed;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length || records.some((r) => isPrivateIP(r.address))) {
    throw new Error('Blocked resolved IP');
  }
  return parsed;
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const VLC_UA = 'VLC/3.0.20 LibVLC/3.0.20';
const EXO_UA = 'ExoPlayerLib/2.19.1 (Linux; Android 11) ExoPlayerLib/2.19.1';

function sanitizeHeaderValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\r\n\0]+/g, ' ').trim().slice(0, 512);
}

function sanitizeReferer(raw: unknown): string {
  const cleaned = sanitizeHeaderValue(raw);
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    /* ignore invalid referer */
  }
  return '';
}

async function fetchWithValidatedRedirects(
  initialUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<{ response: globalThis.Response; finalUrl: string }> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop < 6; hop++) {
    const validated = await validateExternalUrl(currentUrl);
    const response = await fetch(validated.toString(), {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { response, finalUrl: validated.toString() };
      response.body?.cancel().catch(() => {});
      currentUrl = new URL(location, validated).toString();
      continue;
    }
    return { response, finalUrl: validated.toString() };
  }
  throw new Error('Too many redirects');
}

async function fetchUpstreamWithFallback(
  rawUrl: string,
  rangeHeader: string | undefined,
  customUa: string,
  customRef: string,
  signal: AbortSignal
): Promise<{ response: globalThis.Response; finalUrl: string }> {
  const buildHeaders = (ua: string, ref: string): Record<string, string> => {
    const h: Record<string, string> = {
      'User-Agent': ua,
      Accept: '*/*',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
    };
    if (ref) {
      h.Referer = ref;
      try {
        h.Origin = new URL(ref).origin;
      } catch {
        /* ignore */
      }
    }
    if (rangeHeader) h.Range = rangeHeader;
    return h;
  };

  let originRef = '';
  try {
    originRef = new URL(rawUrl).origin + '/';
  } catch {
    /* ignore */
  }

  const profiles: Array<{ ua: string; ref: string }> = customUa
    ? [
        { ua: customUa, ref: customRef },
        { ua: VLC_UA, ref: customRef || originRef },
        { ua: DEFAULT_UA, ref: customRef || originRef },
      ]
    : [
        { ua: DEFAULT_UA, ref: customRef },
        { ua: VLC_UA, ref: customRef || originRef },
        { ua: EXO_UA, ref: customRef },
      ];

  let lastResult: { response: globalThis.Response; finalUrl: string } | null = null;
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    const result = await fetchWithValidatedRedirects(
      rawUrl,
      buildHeaders(profile.ua, profile.ref),
      signal
    );
    lastResult = result;
    if ((result.response.status === 403 || result.response.status === 406) && i < profiles.length - 1) {
      result.response.body?.cancel().catch(() => {});
      continue;
    }
    return result;
  }
  return lastResult!;
}

function makeProxyHref(targetUrl: string, asHls: boolean, ua?: string, ref?: string): string {
  let href = '/api/proxy?url=' + encodeURIComponent(targetUrl) + (asHls ? '&hls=1' : '');
  if (ua) href += '&ua=' + encodeURIComponent(ua);
  if (ref) href += '&ref=' + encodeURIComponent(ref);
  return href;
}

function rewriteHlsPlaylist(body: string, baseUrl: string, ua?: string, ref?: string): string {
  const lines = body.split(/\r?\n/);
  let nextLineIsSubPlaylist = false;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
          nextLineIsSubPlaylist = true;
        }
        if (/URI="([^"]+)"/i.test(line)) {
          const isPlaylistTag = /^#EXT-X-(MEDIA|I-FRAME-STREAM-INF|SESSION-DATA)/i.test(trimmed);
          return line.replace(/URI="([^"]+)"/gi, (_match, rawUri: string) => {
            try {
              const abs = new URL(rawUri, baseUrl).toString();
              const isM3u8 = isPlaylistTag || /\.m3u8?(\?|$)/i.test(abs);
              return `URI="${makeProxyHref(abs, isM3u8, ua, ref)}"`;
            } catch {
              return `URI="${rawUri}"`;
            }
          });
        }
        return line;
      }

      try {
        const abs = new URL(trimmed, baseUrl).toString();
        const asHls = nextLineIsSubPlaylist || /\.m3u8(\?|$)/i.test(abs);
        nextLineIsSubPlaylist = false;
        return makeProxyHref(abs, asHls, ua, ref);
      } catch {
        nextLineIsSubPlaylist = false;
        return line;
      }
    })
    .join('\n');
}

interface VodItemInput {
  id: string;
  title: string;
  kind: 'movie' | 'series';
  group: string;
  genre: string;
  year: string;
  rating: number | null;
}

interface RawRecommendationResponse {
  detectedGenres?: unknown;
  summary?: unknown;
  libraryPicks?: unknown;
  externalSuggestions?: unknown;
}

let cachedGeminiKey = '';
let cachedGeminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!cachedGeminiClient || cachedGeminiKey !== apiKey) {
    cachedGeminiKey = apiKey;
    cachedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedGeminiClient;
}

function sanitizeVodItems(raw: unknown, maxCount: number): VodItemInput[] {
  if (!Array.isArray(raw)) return [];
  const out: VodItemInput[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (out.length >= maxCount) break;
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, 512) : '';
    const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 180) : '';
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const kind = obj.kind === 'series' ? 'series' : 'movie';
    const group = typeof obj.group === 'string' ? obj.group.trim().slice(0, 100) : '';
    const genre = typeof obj.genre === 'string' ? obj.genre.trim().slice(0, 120) : '';
    const year = typeof obj.year === 'string' ? obj.year.trim().slice(0, 8) : '';
    const ratingNum = typeof obj.rating === 'number' && Number.isFinite(obj.rating) && obj.rating > 0 && obj.rating <= 10
      ? Math.round(obj.rating * 10) / 10
      : null;
    out.push({ id, title, kind, group, genre, year, rating: ratingNum });
  }
  return out;
}

async function generateRecommendationsWithRetry(
  ai: GoogleGenAI,
  favorites: VodItemInput[],
  catalog: VodItemInput[]
): Promise<RawRecommendationResponse> {
  const favLines = favorites
    .map((item, idx) => {
      const details = [
        item.kind === 'series' ? 'مسلسل' : 'فيلم',
        item.genre || item.group || '',
        item.year || '',
        item.rating ? `IMDb ${item.rating}` : '',
      ].filter(Boolean);
      return `${idx + 1}. ${item.title}${details.length ? ` (${details.join(' · ')})` : ''}`;
    })
    .join('\n');

  const catalogLines = catalog.length
    ? catalog
        .map((item) => {
          const details = [
            item.kind === 'series' ? 'series' : 'movie',
            item.genre || item.group || '',
            item.year || '',
            item.rating ? `IMDb ${item.rating}` : '',
          ].filter(Boolean);
          return `[ID:${item.id}] ${item.title}${details.length ? ` | ${details.join(' · ')}` : ''}`;
        })
        .join('\n')
    : 'لا توجد عناصر مرشحة متاحة في المكتبة حالياً.';

  const prompt = [
    'أفلام ومسلسلات المستخدم المفضلة:',
    favLines,
    '',
    'الأفلام المتاحة حالياً في مكتبة المستخدم (اختر منها فقط باستخدام نفس معرف ID الحرفي):',
    catalogLines,
    '',
    'المطلوب:',
    '1. استنتج أهم 1 إلى 4 أنواع (Genres) يفضلها المستخدم باللغة العربية (مثل: أكشن، خيال علمي، تشويق، دراما، كوميديا، رعب).',
    '2. اكتب جملة عربية قصيرة ومفيدة (أقل من 18 كلمة) تصف ذوق المستخدم بناءً على مفضلاته.',
    '3. في libraryPicks اختر حتى 10 أفلام مشابهة من القائمة المتاحة أعلاه (فضّل الأفلام movie على المسلسلات، واستخدم نفس catalogId الحرفي تماماً دون اختراع معرفات) مع نوع التطابق matchedGenre ودرجة التطابق matchScore (بين 70 و99) وسبب عربي مختصر (أقل من 14 كلمة).',
    '4. إذا كانت القائمة المتاحة تحتوي على أقل من 6 اختيارات مناسبة، أضف في externalSuggestions حتى 6 أفلام سينمائية معروفة مشابهة لنفس الأنواع المفضلة مع العنوان وسنة الإنتاج والنوع وتقييم IMDb إن عُرف وسبب مختصر؛ وإلا اجعل externalSuggestions مصفوفة فارغة [].',
  ].join('\n');

  const schema = {
    type: Type.OBJECT,
    properties: {
      detectedGenres: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '1 to 4 favorite genres in Arabic.',
      },
      summary: {
        type: Type.STRING,
        description: 'Concise Arabic sentence summarizing the user favorite genres.',
      },
      libraryPicks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            catalogId: { type: Type.STRING },
            matchedGenre: { type: Type.STRING },
            matchScore: { type: Type.INTEGER },
            reason: { type: Type.STRING },
          },
          required: ['catalogId', 'matchedGenre', 'matchScore', 'reason'],
        },
      },
      externalSuggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            year: { type: Type.STRING },
            genre: { type: Type.STRING },
            imdbRating: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ['title', 'year', 'genre', 'reason'],
        },
      },
    },
    required: ['detectedGenres', 'summary', 'libraryPicks', 'externalSuggestions'],
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'أنت خبير توصية أفلام عربي ذكي لتطبيق مكتبة أفلام. التزم بدقة بالمخطط المطلوب JSON، واختر فقط معرفات catalogId الموجودة حرفياً في القائمة المزوّدة دون أي تكرار أو اختراع.',
          responseMimeType: 'application/json',
          responseSchema: schema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const text = (response.text ?? '').trim();
      if (!text) throw new Error('Empty recommendation response');
      return JSON.parse(text) as RawRecommendationResponse;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = /\b(429|500|502|503|504|UNAVAILABLE|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|fetch failed)\b/i.test(msg);
      if (!isRetryable || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 450 * Math.pow(2, attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to generate recommendations');
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, app: 'WasslaTV' });
  });

  app.post('/api/vod/recommendations', async (req: Request, res: Response) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const favorites = sanitizeVodItems(body.favorites, 30);
    if (!favorites.length) {
      res.status(400).json({
        error: 'أضف فيلماً أو مسلسلاً واحداً على الأقل إلى المفضلة للحصول على اقتراحات مشابهة.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'مفتاح واجهة برمجة التطبيقات غير مهيأ على الخادم. يرجى التحقق من إعدادات المفاتيح ثم إعادة المحاولة.',
      });
      return;
    }

    const favIds = new Set(favorites.map((item) => item.id));
    const catalog = sanitizeVodItems(body.catalog, 120).filter((item) => !favIds.has(item.id));
    const validCatalogIds = new Set(catalog.map((item) => item.id));

    try {
      const raw = await generateRecommendationsWithRetry(ai, favorites, catalog);

      const detectedGenres = Array.isArray(raw.detectedGenres)
        ? [...new Set(raw.detectedGenres.map((g) => String(g ?? '').trim()).filter(Boolean))].slice(0, 4)
        : [];
      const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 220) : '';

      const seenPicks = new Set<string>();
      const libraryPicks: Array<{ catalogId: string; matchedGenre: string; matchScore: number; reason: string }> = [];
      if (Array.isArray(raw.libraryPicks)) {
        for (const item of raw.libraryPicks) {
          if (!item || typeof item !== 'object') continue;
          const p = item as Record<string, unknown>;
          const catalogId = typeof p.catalogId === 'string' ? p.catalogId.trim() : '';
          if (!catalogId || !validCatalogIds.has(catalogId) || seenPicks.has(catalogId)) continue;
          seenPicks.add(catalogId);
          const rawScore = Number(p.matchScore);
          const matchScore = Number.isFinite(rawScore) ? Math.max(60, Math.min(99, Math.round(rawScore))) : 88;
          libraryPicks.push({
            catalogId,
            matchedGenre: typeof p.matchedGenre === 'string' ? p.matchedGenre.trim().slice(0, 40) : detectedGenres[0] || 'مقترح',
            matchScore,
            reason: typeof p.reason === 'string' ? p.reason.trim().slice(0, 140) : '',
          });
          if (libraryPicks.length >= 10) break;
        }
      }

      const externalSuggestions: Array<{
        title: string;
        year: string;
        genre: string;
        imdbRating: string;
        reason: string;
      }> = [];
      if (libraryPicks.length < 6 && Array.isArray(raw.externalSuggestions)) {
        const seenTitles = new Set<string>();
        for (const item of raw.externalSuggestions) {
          if (!item || typeof item !== 'object') continue;
          const s = item as Record<string, unknown>;
          const title = typeof s.title === 'string' ? s.title.trim().slice(0, 120) : '';
          if (!title || seenTitles.has(title.toLowerCase())) continue;
          seenTitles.add(title.toLowerCase());
          const rawRating = typeof s.imdbRating === 'string' ? s.imdbRating.trim() : '';
          const ratingMatch = /(\d(?:\.\d)?)/.exec(rawRating);
          const ratingVal = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
          externalSuggestions.push({
            title,
            year: typeof s.year === 'string' ? (s.year.match(/\b(19|20)\d{2}\b/)?.[0] || '') : '',
            genre: typeof s.genre === 'string' ? s.genre.trim().slice(0, 40) : detectedGenres[0] || '',
            imdbRating: ratingVal > 0 && ratingVal <= 10 ? ratingVal.toFixed(1) : '',
            reason: typeof s.reason === 'string' ? s.reason.trim().slice(0, 140) : '',
          });
          if (externalSuggestions.length >= 6) break;
        }
      }

      res.json({
        detectedGenres,
        summary,
        libraryPicks,
        externalSuggestions,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recommendation request failed';
      if (/API_KEY_INVALID|PERMISSION_DENIED|\b403\b/i.test(msg)) {
        res.status(403).json({
          error: 'تعذّر التحقق من مفتاح API للاقتراحات. يرجى التحقق من المفتاح في إعدادات الأسرار.',
        });
        return;
      }
      if (/RESOURCE_EXHAUSTED|\b429\b/i.test(msg)) {
        res.status(429).json({
          error: 'تم تجاوز حد الطلبات المؤقت لخدمة الاقتراحات. يرجى المحاولة مجدداً بعد لحظات.',
        });
        return;
      }
      res.status(502).json({
        error: 'تعذّر جلب الاقتراحات حالياً من واجهة برمجة التطبيقات. يرجى المحاولة مرة أخرى.',
      });
    }
  });

  app.get('/api/proxy', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const hlsMode = req.query.hls === '1';
    const customUa = sanitizeHeaderValue(req.query.ua);
    const customRef = sanitizeReferer(req.query.ref);

    if (!rawUrl) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    req.on('close', () => {
      clearTimeout(timeoutId);
      controller.abort();
    });

    try {
      const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
      const { response: upstream, finalUrl } = await fetchUpstreamWithFallback(
        rawUrl,
        rangeHeader,
        customUa,
        customRef,
        controller.signal
      );
      clearTimeout(timeoutId);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const looksLikeHls =
        hlsMode &&
        (/mpegurl/i.test(contentType) ||
          /\.m3u8?(\?|$)/i.test(finalUrl) ||
          /^text\//i.test(contentType));

      if (looksLikeHls && upstream.ok) {
        const text = await upstream.text();
        if (text.trimStart().startsWith('#EXTM3U')) {
          res.status(upstream.status);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          res.send(rewriteHlsPlaylist(text, finalUrl, customUa, customRef));
          return;
        }
        res.status(upstream.status);
        res.setHeader('Content-Type', contentType);
        res.send(text);
        return;
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as unknown as WebReadableStream);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      nodeStream.pipe(res);
    } catch (err) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted && req.destroyed) return;
      const message = err instanceof Error ? err.message : 'Upstream fetch failed';
      const status = /Invalid URL|Unsupported protocol|Blocked/.test(message) ? 400 : 502;
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      }
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'mpa',
    });
    app.use(vite.middlewares);
    app.use(express.static(PUBLIC_DIR));
  } else {
    const staticRoot = fs.existsSync(DIST_DIR) ? DIST_DIR : PUBLIC_DIR;
    app.use(express.static(staticRoot));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(staticRoot, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`WasslaTV server running at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start WasslaTV server:', err);
  process.exit(1);
});
