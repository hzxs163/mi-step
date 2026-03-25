/**
 * Cloudflare Pages Functions - 小米运动步数修改接口
 * 完整异常捕获 + 标准化 JSON 响应 + 参数校验
 */
export async function onRequestPost(context) {
  // 初始化日志
  const log = [];
  log.push(`[${new Date().toLocaleString()}] 接口请求开始`);

  try {
    // 1. 跨域头配置（必须）
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // 2. 处理 OPTIONS 预检请求
    if (context.request.method === "OPTIONS") {
      return new Response(JSON.stringify({ status: "success", message: "预检成功" }), { headers });
    }

    // 3. 获取并校验表单参数
    const formData = await context.request.formData();
    const user = formData.get("account")?.trim();
    const pwd = formData.get("password")?.trim();
    const step = formData.get("step")?.trim();

    log.push(`获取参数：账号=${user}, 步数=${step}`);

    // 基础参数校验
    if (!user || !pwd) {
      throw new Error("账号/密码不能为空");
    }
    if (!step || isNaN(step) || Number(step) < 10 || Number(step) > 39999) {
      throw new Error("步数必须是10-39999之间的数字");
    }
    const stepNum = Number(step);

    // 4. 配置项（可替换为 Cloudflare 环境变量）
    const CONFIG = {
      TOKEN: context.env.VALID_TOKEN || "147369", // 接口验证token
      AES_KEY: context.env.AES_KEY || "xeNtBVqzDc6tuNTh", // AES加密密钥
      AES_IV: context.env.AES_IV || "MAAAYAAAAAAAAABg", // AES加密向量
      DEVICE_ID: "your_device_id_here", // 替换为实际设备ID
      LAST_DEVICE_ID: "your_last_deviceid_here" // 替换为实际设备ID
    };

    // 5. AES加密（适配原PHP逻辑）
    function aesEncrypt(text, key = CONFIG.AES_KEY, iv = CONFIG.AES_IV) {
      const encoder = new TextEncoder();
      const data = encoder.encode(text.padEnd(Math.ceil(text.length / 16) * 16, "\0")); // PKCS7补位
      const cryptoKey = crypto.subtle.importKey(
        "raw",
        encoder.encode(key),
        { name: "AES-CBC" },
        false,
        ["encrypt"]
      );
      return crypto.subtle.encrypt(
        { name: "AES-CBC", iv: encoder.encode(iv) },
        cryptoKey,
        data
      ).then(encrypted => btoa(String.fromCharCode(...new Uint8Array(encrypted))));
    }

    // 6. 登录获取token（核心逻辑）
    log.push("开始登录获取token");
    const encryptedPwd = await aesEncrypt(pwd);
    const loginRes = await fetch("https://api-user.huami.com/registrations/+86" + user + "/tokens", {
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
      throw new Error(`登录失败：${loginRes.status} ${loginRes.statusText}`);
    }
    const loginData = await loginRes.json();
    const accessToken = loginData.token_info?.access_token;
    if (!accessToken) {
      throw new Error("登录成功但未获取到access_token");
    }
    log.push("登录成功，获取到access_token");

    // 7. 提交步数
    log.push(`开始提交步数：${stepNum}`);
    const submitRes = await fetch("https://api-mifit-cn.huami.com/v1/data/band_data.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        "authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        "userid": user,
        "last_deviceid": CONFIG.LAST_DEVICE_ID,
        "device_id": CONFIG.DEVICE_ID,
        "data_json": `[{"sport_type":0,"start_time":${Date.now() - 86400000},"end_time":${Date.now()},"data":[{"time":${Date.now() - 3600000},"value":${stepNum}}]}]`,
        "upload_time": Date.now(),
        "device_type": "android_phone",
        "band_type": "smartband",
        "app_version": "6.6.0",
        "os_version": "13",
        "device_model": "MIUI",
        "sync_type": "realtime"
      })
    });

    if (!submitRes.ok) {
      throw new Error(`提交步数失败：${submitRes.status} ${submitRes.statusText}`);
    }
    const submitData = await submitRes.json();
    log.push(`步数提交响应：${JSON.stringify(submitData)}`);

    // 8. 成功响应
    return new Response(JSON.stringify({
      status: "success",
      message: `步数修改成功！已提交 ${stepNum} 步`,
      log: log.join("\n"),
      time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      user: user,
      step: stepNum
    }), { headers });

  } catch (err) {
    // 9. 全局异常捕获（关键：确保始终返回JSON）
    log.push(`异常：${err.message}`);
    console.error("接口异常：", err); // Cloudflare日志

    return new Response(JSON.stringify({
      status: "failed",
      message: err.message || "服务器内部错误",
      log: log.join("\n"),
      time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      user: formData.get("account") || "",
      step: formData.get("step") || ""
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
