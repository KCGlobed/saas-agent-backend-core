const PLACEHOLDER = /\{\{([^}]+)\}\}/g;

const MAX_TOOL_BODY_CHARS = 100_000;

function resolveTemplate(str, env) {
  if (str === undefined || str === null) return '';
  if (typeof str !== 'string') return String(str);
  return str.replace(PLACEHOLDER, (_, key) => {
    const k = String(key).trim();
    const v = env[k];
    return v !== undefined && v !== null ? String(v) : '';
  });
}

function buildProcessEnvMap() {
  return { ...process.env };
}

function mergeQueryParams(queryParamsSchema, toolArgs) {
  const out = {};
  if (queryParamsSchema && typeof queryParamsSchema === 'object') {
    for (const [key, spec] of Object.entries(queryParamsSchema)) {
      if (spec && typeof spec === 'object' && 'default' in spec && spec.default !== undefined) {
        out[key] = spec.default;
      }
    }
  }
  if (toolArgs && typeof toolArgs === 'object') {
    Object.assign(out, toolArgs);
  }
  return out;
}

function truncateBody(text) {
  if (text.length <= MAX_TOOL_BODY_CHARS) return text;
  return `${text.slice(0, MAX_TOOL_BODY_CHARS)}\n…[truncated]`;
}

/**
 * Executes one catalogued API (from collection.json) server-side.
 * @param {object} collection - Parsed collection.json
 * @param {string} toolName - API `name` field
 * @param {object} toolArgs - Merged into query string (GET)
 */
async function executeApiTool(collection, toolName, toolArgs) {
  const apis = collection?.apis;
  if (!Array.isArray(apis)) {
    return JSON.stringify({ error: 'Invalid api collection' });
  }
  const api = apis.find((a) => a.name === toolName);
  if (!api) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }

  const env = buildProcessEnvMap();
  const baseTemplate = api.base_override || collection.base_url || '';
  const base = resolveTemplate(baseTemplate, env).replace(/\/$/, '');
  if (!base) {
    return JSON.stringify({
      error: 'Resolved base URL is empty. Set env vars for placeholders in base_url / base_override (e.g. GCC_Base_url).',
    });
  }

  const path = api.endpoint || '';
  const fullUrl = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = { Accept: 'application/json' };
  const auth = collection.auth;
  if (auth?.type === 'bearer' && auth.token_env) {
    const token = process.env[auth.token_env];
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const method = (api.method || 'GET').toUpperCase();
  const merged = mergeQueryParams(api.query_params, toolArgs);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === '') continue;
    qs.append(k, String(v));
  }
  const urlWithQs = qs.toString() ? `${fullUrl}?${qs.toString()}` : fullUrl;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 45_000);
    const r = await fetch(urlWithQs, { method, headers, signal: controller.signal });
    clearTimeout(t);
    const text = await r.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    if (!r.ok) {
      return truncateBody(
        JSON.stringify({
          error: true,
          status: r.status,
          statusText: r.statusText,
          body: parsed,
        })
      );
    }
    const out = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    return truncateBody(out);
  } catch (e) {
    return JSON.stringify({ error: true, message: e.message || String(e) });
  }
}

module.exports = { executeApiTool, resolveTemplate };
