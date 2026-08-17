// main.ts
const VALID_API_KEY = "274F20CCF87d4524b679be1C39dFecea";
// =========【必须修改】填入上游 Ollama 兼容接口地址 =========
const UPSTREAM_OLLAMA_ENDPOINT = "https://xxx";
const DEFAULT_MODEL = "deepseek-v4-flash:cloud";
// ========================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // OPTIONS预检：直接放行，不做鉴权！解决浏览器跨域401
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 双方式鉴权：Header Bearer 或者 url ?key=xxx
  let authorized = false;
  const authHeader = req.headers.get("Authorization");
  const urlKey = url.searchParams.get("key");

  if (authHeader && authHeader === `Bearer ${VALID_API_KEY}`) {
    authorized = true;
  }
  if (urlKey === VALID_API_KEY) {
    authorized = true;
  }

  if (!authorized) {
    return Response.json(
      { error: "密钥验证失败" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    // GET /api/chat?message=xxx&key=xxx
    if (req.method === "GET" && url.pathname === "/api/chat") {
      const userMsg = url.searchParams.get("message");
      if (!userMsg) {
        return Response.json(
          { error: "缺少参数 message" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

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
      return Response.json(data, { headers: CORS_HEADERS });
    }

    // POST /api/chat 标准接口（Scratch扩展使用）
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
  } catch (err) {
    // 捕获所有异常，确保永远返回JSON，不会出现纯文本Internal Server Error
    return Response.json(
      { error: "服务器内部异常", detail: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

Deno.serve(handleRequest);
