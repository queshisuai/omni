const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function backendBaseUrl(): string | null {
  const configuredTarget = process.env.API_PROXY_TARGET?.trim();
  return configuredTarget ? configuredTarget.replace(/\/+$/, '') : null;
}

function backendUrl(baseUrl: string, prefix: string, path: string[], search: string): string {
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  return `${baseUrl}/${prefix}${encodedPath ? `/${encodedPath}` : ''}${search}`;
}

function forwardHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const header of ['accept', 'authorization', 'content-type', 'cookie', 'x-requested-with']) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  return headers;
}

function responseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers(upstreamHeaders);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  headers.delete('content-encoding');
  return headers;
}

export async function proxyToBackend(request: Request, prefix: string, path: string[] = []): Promise<Response> {
  const sourceUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const baseUrl = backendBaseUrl();
  if (!baseUrl) {
    return new Response(JSON.stringify({ code: 503, message: '后端代理目标未配置', data: null }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
  const targetUrl = backendUrl(baseUrl, prefix, path, sourceUrl.search);

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders(request),
      body,
      cache: 'no-store',
      redirect: 'manual',
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream.headers),
    });
  } catch (error) {
    console.error(`Backend proxy failed: ${method} ${targetUrl}`, error);
    return new Response(JSON.stringify({ code: 503, message: '服务暂不可用，请稍后重试', data: null }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
