const http = require("http");

async function checkUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  console.log("Checking Next.js dev server HTTP responses...");

  try {
    // 1. Check /login
    const loginRes = await checkUrl("http://localhost:3000/login");
    console.log(`[HTTP 1] GET /login -> Status ${loginRes.statusCode} (${loginRes.body.length} bytes)`);

    // 2. Check /admin/maintenance
    const maintRes = await checkUrl("http://localhost:3000/admin/maintenance");
    console.log(`[HTTP 2] GET /admin/maintenance -> Status ${maintRes.statusCode} (Redirect or rendered: ${maintRes.headers.location || "Rendered"})`);

    console.log("\nNext.js server is actively serving requests!");
  } catch (err) {
    console.error("HTTP check error:", err);
  }
}

run();
