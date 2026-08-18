const PROXY_TOKEN = "274f20ccf87d4524b679be1c39dfecea";
const OPENMODEL_API_KEY = "om-eiiRoojesXRXjgQDnPcfpaiPHnSmDr469AHAWfxsL";
const UPSTREAM = "https://api.openmodel.ai/v1/chat/completions";
const MODEL_ID = "deepseek-v4-flash";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const clientToken = url.searchParams.get("token");
  if (!clientToken || clientToken !== PROXY_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized proxy token" }), {
      status: 401, headers: { ...CORS_HEADERS, "Content-Type":"application/json" }
    });
  }

  const rawParam = url.searchParams.get("data");
  if (!rawParam) {
    return new Response(JSON.stringify({ error: "缺少 data 参数" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type":"application/json" }
    });
  }

  try {
    const payload = JSON.parse(decodeURIComponent(rawParam));
    const requestBody = {
      model: MODEL_ID,
      messages: payload.messages,
      stream: !!payload.stream
    };

    console.log("向上游发送请求体：", requestBody);

    const upstreamRes = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENMODEL_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const upstreamJson = await upstreamRes.json();
    console.log("上游原始返回：", upstreamJson);

    if(requestBody.stream){
      return new Response(JSON.stringify({warn:"流式暂不支持GET调用"}), {
        headers: { ...CORS_HEADERS, "Content-Type":"application/json" }
      });
    }

    const result = {
      model: MODEL_ID,
      message: {
        role: "assistant",
        content: upstreamJson?.choices?.[0]?.message?.content ?? ""
      },
      raw: upstreamJson
    };
    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type":"application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type":"application/json" }
    });
  }
}

Deno.serve(handleRequest);
