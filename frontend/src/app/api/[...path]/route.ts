import { proxyToBackend } from '@/lib/server-proxy';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return proxyToBackend(request, 'api', params.path ?? []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
