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

    log.push(`获取参数：账号=${account}, 步数=${step}`);

    if (!account || !password || !step) {
      throw new Error("账号/密码/步数不能为空");
    }
    const targetStep = Number(step);
    if (targetStep < 10 || targetStep > 39999) {
      throw new Error("步数必须在 10-39999 之间");
    }

    // 1. AES 加密密码（适配小米）
    log.push("开始加密密码");
    const aesKey = "xeNtBVqzDc6tuNTh";
    const aesIv = "MAAAYAAAAAAAAABg";
    const encryptedPwd = await aesEncrypt(password, aesKey, aesIv);
    log.push("密码加密完成");

    // 2. 登录小米获取 token
    log.push("开始登录小米账号");
    const loginRes = await fetch(`https://api-user.huami.com/registrations/+86${account}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "HuaMi",
        password: encryptedPwd,
        country_code: "CN",
        login_token: "",
        code: "",
        redirect_uri: "",
        token: "access"
      })
    });

    if (!loginRes.ok) {
      throw new Error(`登录失败 [${loginRes.status}]：账号或密码错误`);
    }

    const loginData = await loginRes.json();
    const accessToken = loginData.token_info?.access_token;
    if (!accessToken) {
      throw new Error("登录成功，但未获取到访问令牌");
    }
    log.push("登录成功，获取到 access_token");

    // 3. 提交步数到小米服务器
    log.push(`开始提交步数：${targetStep} 步`);
    const now = Date.now();
    const submitRes = await fetch("https://api-mifit-cn.huami.com/v1/data/band_data.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        "authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        "userid": account,
        "last_deviceid": "MI_BAND_8",
        "device_id": "android_phone_123456",
        "data_json": `[{"sport_type":0,"start_time":${now - 86400000},"end_time":${now},"data":[{"time":${now - 3600000},"value":${targetStep}}]}]`,
        "upload_time": now,
        "device_type": "android_phone",
        "band_type": "smartband",
        "app_version": "6.6.0",
        "os_version": "13",
        "device_model": "MIUI",
        "sync_type": "realtime"
      })
    });

    if (!submitRes.ok) {
      throw new Error(`步数提交失败 [${submitRes.status}]：小米服务器拒绝请求`);
    }

    const submitData = await submitRes.json();
    log.push(`步数提交成功，小米响应：${JSON.stringify(submitData)}`);

    return new Response(JSON.stringify({
      status: "success",
      message: `✅ 步数修改成功！账号 ${account} 已提交 ${targetStep} 步，稍后在小米运动 App 中查看`,
      log: log.join("\n")
    }), { headers });

  } catch (err) {
    log.push(`处理失败：${err.message}`);
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

// AES-CBC 加密（适配小米密码加密规则）
async function aesEncrypt(text, key, iv) {
  const encoder = new TextEncoder();
  const padding = 16 - (text.length % 16);
  const padded = text + String.fromCharCode(padding).repeat(padding);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: encoder.encode(iv) },
    cryptoKey,
    encoder.encode(padded)
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
