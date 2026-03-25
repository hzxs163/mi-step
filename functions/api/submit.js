export async function onRequestPost(context) {
  const log = [`[${new Date().toLocaleString()}] 接口测试`];

  try {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    };

    if (context.request.method === "OPTIONS") {
      return new Response(JSON.stringify({ status: "success", message: "预检成功" }), { headers });
    }

    const formData = await context.request.formData();
    const account = formData.get("account")?.trim();
    const step = formData.get("step")?.trim();

    return new Response(JSON.stringify({
      status: "success",
      message: `✅ 测试成功！账号：${account}，目标步数：${step}（仅测试，未修改真实步数）`,
      log: log.join("\n")
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      status: "failed",
      message: err.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
