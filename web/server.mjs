/**
 * Production-style static server + /openai/* proxy so the browser can call OpenAI
 * without CORS blocks (personal use; API key still sent from the browser).
 *
 * Usage: npm run build && npm run start
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 21079);
const OPENAI_PROXY_MAX_BODY_BYTES = Number(process.env.OPENAI_PROXY_MAX_BODY_BYTES || 8 * 1024 * 1024);
const OPENAI_PROXY_TIMEOUT_MS = Number(process.env.OPENAI_PROXY_TIMEOUT_MS || 30000);

const OPENAI_PROXY_ALLOWED = new Map([
  ['/v1/chat/completions', new Set(['POST'])],
  ['/v1/models', new Set(['GET'])],
  ['/v1/realtime/calls', new Set(['POST'])],
  ['/v1/audio/transcriptions', new Set(['POST'])],
  ['/v1/audio/speech', new Set(['POST'])],
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function sendStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(dist, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const fallback = path.join(dist, 'index.html');
      fs.readFile(fallback, (e2, html) => {
        if (e2) {
          res.writeHead(404).end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyOpenAI(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const targetPathname = parsedUrl.pathname.replace(/^\/openai/, '') || '/';
  const allowedMethods = OPENAI_PROXY_ALLOWED.get(targetPathname);
  if (!allowedMethods?.has(req.method || 'GET')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('OpenAI proxy endpoint not allowed');
    req.resume();
    return;
  }

  const targetPath = `${targetPathname}${parsedUrl.search}`;
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > OPENAI_PROXY_MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Request body too large');
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (res.headersSent) return;
    const body = Buffer.concat(chunks);
    const auth = req.headers.authorization || '';
    /** @type {Record<string, string | number>} */
    const headers = {
      Authorization: auth,
      'OpenAI-Safety-Identifier': String(req.headers['openai-safety-identifier'] || 'hinttalk-local'),
    };
    const ct = req.headers['content-type'];
    const cl = req.headers['content-length'];
    if (ct) headers['Content-Type'] = ct;
    if (cl) headers['Content-Length'] = Number(cl);

    const opt = {
      hostname: 'api.openai.com',
      port: 443,
      path: targetPath,
      method: req.method,
      headers,
    };

    const preq = https.request(opt, (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers);
      pres.pipe(res);
    });
    preq.setTimeout(OPENAI_PROXY_TIMEOUT_MS, () => {
      preq.destroy(new Error('OpenAI proxy timeout'));
    });
    preq.on('error', (e) => {
      if (res.headersSent) return;
      res.writeHead(502).end(String(e.message));
    });
    if (body.length) preq.write(body);
    preq.end();
  });
}

function proxyTTS(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Method not allowed');
    req.resume();
    return;
  }

  let targetBase;
  try {
    targetBase = new URL(String(req.headers['x-tts-base-url'] || '').replace(/\/+$/, ''));
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Missing or invalid TTS base URL');
    req.resume();
    return;
  }
  if (targetBase.protocol !== 'https:') {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('TTS base URL must use https');
    req.resume();
    return;
  }

  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > OPENAI_PROXY_MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Request body too large');
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (res.headersSent) return;
    const body = Buffer.concat(chunks);
    const cleanPath = targetBase.pathname.replace(/\/+$/, '');
    const targetPathname = cleanPath.endsWith('/audio/speech') ? cleanPath : `${cleanPath}/audio/speech`;
    const target = new URL(targetPathname, targetBase);
    const headers = {
      Authorization: String(req.headers.authorization || ''),
      'Content-Type': String(req.headers['content-type'] || 'application/json'),
      'Content-Length': body.length,
    };
    const opt = {
      hostname: target.hostname,
      port: 443,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers,
    };
    const preq = https.request(opt, (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers);
      pres.pipe(res);
    });
    preq.setTimeout(OPENAI_PROXY_TIMEOUT_MS, () => {
      preq.destroy(new Error('TTS proxy timeout'));
    });
    preq.on('error', (e) => {
      if (res.headersSent) return;
      res.writeHead(502).end(String(e.message));
    });
    if (body.length) preq.write(body);
    preq.end();
  });
}

function proxyGeneric(req, res) {
  const targetHeader = req.headers['x-proxy-target'];
  let targetBase;
  try {
    targetBase = new URL(String(targetHeader || '').replace(/\/+$/, ''));
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Missing or invalid X-Proxy-Target header');
    req.resume();
    return;
  }

  if (targetBase.protocol !== 'https:' && targetBase.protocol !== 'http:') {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('X-Proxy-Target protocol must be http or https');
    req.resume();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const targetPathname = parsedUrl.pathname.replace(/^\/api-proxy/, '') || '/';
  const targetPath = `${targetBase.pathname.replace(/\/+$/, '')}${targetPathname}${parsedUrl.search}`;

  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > OPENAI_PROXY_MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Request body too large');
      req.destroy();
      return;
    }
    chunks.push(c);
  });

  req.on('end', () => {
    if (res.headersSent) return;
    const body = Buffer.concat(chunks);

    const headers = { ...req.headers };
    delete headers['x-proxy-target'];
    delete headers['host'];
    delete headers['connection'];
    delete headers['keep-alive'];

    const targetUrl = new URL(targetPath, targetBase);
    console.log(`[Prod Proxy Req] ${req.method} ${req.url} -> ${targetUrl.href}`);
    const clientModule = targetUrl.protocol === 'https:' ? https : http;
    const opt = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: req.method,
      headers,
    };

    const preq = clientModule.request(opt, (pres) => {
      console.log(`[Prod Proxy Res] ${req.method} ${req.url} -> Status: ${pres.statusCode}`);
      res.writeHead(pres.statusCode || 502, pres.headers);
      pres.pipe(res);
    });

    preq.setTimeout(OPENAI_PROXY_TIMEOUT_MS, () => {
      preq.destroy(new Error('Generic proxy timeout'));
    });

    preq.on('error', (e) => {
      if (res.headersSent) return;
      res.writeHead(502).end(String(e.message));
    });

    if (body.length) preq.write(body);
    preq.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/openai')) {
    proxyOpenAI(req, res);
    return;
  }
  if (req.url.startsWith('/tts/audio/speech')) {
    proxyTTS(req, res);
    return;
  }
  if (req.url.startsWith('/api-proxy')) {
    proxyGeneric(req, res);
    return;
  }
  sendStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`HintTalk static + OpenAI proxy → http://localhost:${PORT}`);
});
