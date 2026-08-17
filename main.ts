// main.ts
// 你的代理访问密钥
const PROXY_ACCESS_KEY = "274F20CCF87d4524b679be1C39dFecea";
// 上游固定 Ollama Cloud
const OLLAMA_UPSTREAM = "https://ollama.com";
const DEFAULT_MODEL = "deepseek-v4-flash:cloud";
// 【重要】填入你自己 Ollama 官网账号的 API Key，否则调用cloud模型会鉴权失败
const OLLAMA_ACCOUNT_TOKEN = "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // 跨域预检请求，直接放行，不鉴权
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 代理权限校验：Header Bearer 或者 url ?key=xxx
  const authHeader = req.headers.get("Authorization");
  const queryKey = url.searchParams.get("key");
  let authOK = false;
  if (authHeader === `Bearer ${PROXY_ACCESS_KEY}`) authOK = true;
  if (queryKey === PROXY_ACCESS_KEY) authOK = true;

  if (!authOK) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    // GET 简易链接模式：浏览器直接打开
    if (req.method === "GET" && url.pathname === "/api/chat") {
      const userMsg = url.searchParams.get("message");
      if (!userMsg) {
        return Response.json({ error: "缺少参数 message" }, { status: 400, headers: CORS_HEADERS });
      }
      const payload = {
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: userMsg }],
        stream: false
      };
      const upstreamHeaders: Record<string, string> = {
        "Content-Type": "application/json"
      };
      // 如果填写了Ollama账号token，则带上
      if (OLLAMA_ACCOUNT_TOKEN) {
        upstreamHeaders["Authorization"] = `Bearer ${OLLAMA_ACCOUNT_TOKEN}`;
      }

      const upstreamRes = await fetch(`${OLLAMA_UPSTREAM}/api/chat`, {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify(payload)
      });

      const data = await upstreamRes.json();
      return Response.json(data, { headers: CORS_HEADERS });
    }

    // POST 标准接口，供Scratch扩展使用
    if (req.method === "POST" && url.pathname === "/api/chat") {
      const targetUrl = new URL("/api/chat", OLLAMA_UPSTREAM);
      const newHeaders = new Headers(req.headers);
      newHeaders.delete("Authorization");
      if (OLLAMA_ACCOUNT_TOKEN) {
        newHeaders.set("Authorization", `Bearer ${OLLAMA_ACCOUNT_TOKEN}`);
      }

      const upstreamRes = await fetch(targetUrl, {
        method: "POST",
        headers: newHeaders,
        body: req.body
      });

      const outHeaders = new Headers(upstreamRes.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => outHeaders.set(k, v));
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: outHeaders
      });
    }

    return Response.json({ error: "Not Found" }, { status: 404, headers: CORS_HEADERS });
  } catch (err) {
    return Response.json(
      { error: "服务器内部异常", detail: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

Deno.serve(handleRequest);
