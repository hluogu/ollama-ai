// main.ts
const VALID_API_KEY = "274F20CCF87d4524b679be1C39dFecea";
const UPSTREAM_OLLAMA_ENDPOINT = "填写上游Ollama兼容地址";
const DEFAULT_MODEL = "deepseek-v4-flash:cloud";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // CORS预检
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 鉴权
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${VALID_API_KEY}`) {
    return Response.json(
      { error: "Authorization 密钥无效" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // =====================
  // GET /api/chat?message=xxx 简易链接模式
  // =====================
  if (req.method === "GET" && url.pathname === "/api/chat") {
    const userMsg = url.searchParams.get("message");
    if (!userMsg) {
      return Response.json(
        { error: "URL参数缺少 message" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 构造标准ollama chat请求体
    const payload = {
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: userMsg }],
      stream: false,
    };

    const upstreamUrl = new URL("/api/chat", UPSTREAM_OLLAMA_ENDPOINT);
    const upstreamResp = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await upstreamResp.json();
    const resultHeaders = new Headers(CORS_HEADERS);
    return Response.json(data, { headers: resultHeaders });
  }

  // =====================
  // 原有POST /api/chat 兼容模式（供Scratch扩展继续使用）
  // =====================
  if (req.method === "POST" && url.pathname === "/api/chat") {
    const upstreamUrl = new URL("/api/chat", UPSTREAM_OLLAMA_ENDPOINT);
    const newHeaders = new Headers(req.headers);
    newHeaders.delete("Authorization");

    const proxyResp = await fetch(upstreamUrl, {
      method: "POST",
      headers: newHeaders,
      body: req.body,
    });

    const outHeaders = new Headers(proxyResp.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => outHeaders.set(k, v));
    return new Response(proxyResp.body, {
      status: proxyResp.status,
      headers: outHeaders,
    });
  }

  return Response.json({ error: "路由不存在" }, { status: 404, headers: CORS_HEADERS });
}

Deno.serve(handleRequest);
