/** 探针函数：只用来验证 cloud-functions 目录是否会被平台识别。验证完删除。 */
export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, probe: "ping" }), {
    headers: { "content-type": "application/json" },
  });
}
