/** Minimal HTTP helpers for the Node serverless functions. */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    json(res, 405, { error: 'method_not_allowed' });
    return false;
  }
  return true;
}
