// main.ts
const PROXY_KEY = "274F20CCF87d4524b679be1C39dFecea";
const OLLAMA_CLOUD_URL = "https://ollama.com";
const DEFAULT_MODEL = "deepseek-v4-flash:cloud";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // OPTIONS预检放行，不鉴权
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 校验代理密钥
  const authHeader = req.headers.get("Authorization");
  const queryKey = url.searchParams.get("key");
  let pass = false;
  if (authHeader === `Bearer ${PROXY_KEY}`) pass = true;
  if (queryKey === PROXY_KEY) pass = true;
  if (!pass) {
    return Response.json({ error: "密钥错误" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    // GET简易链接模式 /api/chat?key=xxx&message=xxx
    if (req.method === "GET" && url.pathname === "/api/chat") {
      const msg = url.searchParams.get("message");
      if (!msg) return Response.json({ error: "缺少message参数" }, { status: 400, headers:CORS_HEADERS });
      const payload = {
        model: DEFAULT_MODEL,
        messages: [{role:"user", content: msg}],
        stream: false
      };
      const upstreamResp = await fetch(`${OLLAMA_CLOUD_URL}/api/chat`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const data = await upstreamResp.json();
      return Response.json(data, { headers:CORS_HEADERS });
    }

    // POST标准接口（Scratch扩展使用）
    if (req.method === "POST" && url.pathname === "/api/chat") {
      const target = new URL("/api/chat", OLLAMA_CLOUD_URL);
      const proxyResp = await fetch(target, {
        method: req.method,
        headers: req.headers,
        body: req.body
      });
      const outHeaders = new Headers(proxyResp.headers);
      Object.entries(CORS_HEADERS).forEach(([k,v])=>outHeaders.set(k,v));
      return new Response(proxyResp.body, { status: proxyResp.status, headers: outHeaders });
    }

    return Response.json({error:"路由不存在"},{status:404, headers:CORS_HEADERS});
  } catch(err) {
    return Response.json({error:"服务器内部异常", detail: String(err)}, {status:500, headers:CORS_HEADERS});
  }
}

Deno.serve(handleRequest);
