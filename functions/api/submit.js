// functions/api/submit.js
export async function onRequestPost() {
  return new Response(
    JSON.stringify({ status: "success", message: "接口正常！" }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
