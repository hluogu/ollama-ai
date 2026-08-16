// main.ts
const VALID_API_KEY = "274F20CCF87d4524b679be1C39dFecea";
// ========= 请修改这里：上游 Ollama / 兼容接口地址 =========
const UPSTREAM_BASE = "https://替换为你的上游ollama兼容地址";
// =======================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

async function handleRequest(req: Request): Promise<Response> {
  // OPTIONS 预检
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 鉴权
  const auth = req.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${VALID_API_KEY}`) {
    return new Response(JSON.stringify({ error: "无效密钥" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // 构造目标地址
  const originUrl = new URL(req.url);
  const targetUrl = new URL(originUrl.pathname + originUrl.search, UPSTREAM_BASE);

  const newHeaders = new Headers(req.headers);
  newHeaders.delete("Authorization");

  const proxyReq = new Request(targetUrl, {
    method: req.method,
    headers: newHeaders,
    body: req.body,
    redirect: "follow",
  });

  try {
    const upstreamRes = await fetch(proxyReq);
    const resHeaders = new Headers(upstreamRes.headers);
    // 注入CORS
    Object.entries(CORS_HEADERS).forEach(([k, v]) => resHeaders.set(k, v));

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "上游接口连接失败", message: String(err) }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(handleRequest);
