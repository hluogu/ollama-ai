const PROXY_TOKEN = "274f20ccf87d4524b679be1c39dfecea";
const OPENMODEL_API_KEY = "om-eiiRoojesXRXjgQDnPcfpaiPHnSmDr469AHAWfxsL";
const UPSTREAM = "https://api.openmodel.ai/v1/chat/completions";
const MODEL_ID = "deepseek-v4-flash";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

async function handleRequest(req: Request): Promise<Response> {
  // 跨域预检
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // ========== 关键日志 + 清晰405提示 ==========
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({error:`禁止使用 ${req.method}，仅支持 POST 请求`}),
      { status: 405, headers: CORS_HEADERS }
    );
  }

  const auth = req.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${PROXY_TOKEN}`) {
    return new Response(JSON.stringify({ error: "Unauthorized proxy token" }), {
      status: 401, headers: CORS_HEADERS
    });
  }

  try {
    const clientPayload = await req.json();
    const openaiBody = {
      model: MODEL_ID,
      messages: clientPayload.messages,
      stream: !!clientPayload.stream
    };

    const upstreamResponse = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENMODEL_API_KEY}`
      },
      body: JSON.stringify(openaiBody)
    });

    if (openaiBody.stream) {
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: { ...CORS_HEADERS, ...Object.fromEntries(upstreamResponse.headers) }
      });
    }

    const data = await upstreamResponse.json();
    const ollamaStyleResp = {
      model: MODEL_ID,
      message: {
        role: "assistant",
        content: data?.choices?.[0]?.message?.content ?? ""
      }
    };

    return new Response(JSON.stringify(ollamaStyleResp), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: CORS_HEADERS
    });
  }
}

Deno.serve(handleRequest);
