export async function onRequestPost(context) {
  const log = [`[${new Date().toLocaleString()}] 开始处理请求`];

  try {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (context.request.method === "OPTIONS") {
      return new Response(JSON.stringify({ status: "success", message: "预检成功" }), { headers });
    }

    const formData = await context.request.formData();
    const account = formData.get("account")?.trim();
    const password = formData.get("password")?.trim();
    const step = formData.get("step")?.trim();

    log.push(`参数：账号=${account}, 步数=${step}`);

    if (!account || !password || !step) {
      throw new Error("账号/密码/步数不能为空");
    }
    const stepNum = Number(step);
    if (stepNum < 10 || stepNum > 39999) {
      throw new Error("步数必须在 10-39999 之间");
    }

    // 先返回一个测试成功，验证接口是否能正常跑通
    return new Response(JSON.stringify({
      status: "success",
      message: `接口正常！账号：${account}，目标步数：${stepNum}`,
      log: log.join("\n")
    }), { headers });

  } catch (err) {
    log.push(`错误：${err.message}`);
    return new Response(JSON.stringify({
      status: "failed",
      message: err.message || "服务器内部错误",
      log: log.join("\n")
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
