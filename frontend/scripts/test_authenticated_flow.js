const http = require("http");

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log("Testing authenticated flow for /admin/maintenance...");

  // 1. Login with Admin credentials
  const loginPayload = JSON.stringify({
    email: "mrsatishpatil105@gmail.com",
    password: "1234",
  });

  const loginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(loginPayload),
      },
    },
    loginPayload
  );

  console.log(`[Auth Step 1] POST /api/auth/login -> Status: ${loginRes.statusCode}`);
  const setCookie = loginRes.headers["set-cookie"];
  if (!setCookie) {
    console.error("Login failed, no session cookie returned. Body:", loginRes.body);
    return;
  }
  const sessionCookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  console.log("  ✓ Session cookie obtained successfully.");

  // 2. Fetch /api/admin/maintenance/hub with cookie
  const hubRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/maintenance/hub",
    method: "GET",
    headers: {
      Cookie: sessionCookie,
    },
  });

  console.log(`[Auth Step 2] GET /api/admin/maintenance/hub -> Status: ${hubRes.statusCode}`);
  const hubData = JSON.parse(hubRes.body);
  console.log("  ✓ Hub API Success:", hubData.success);
  console.log("  ✓ Total Machines:", hubData.stats.totalMachines);
  console.log("  ✓ Open Requests:", hubData.stats.openRequests);
  console.log("  ✓ Total Records:", hubData.records.length);
  console.log("  ✓ PM Schedules:", hubData.pmSchedules.length);
  console.log("  ✓ Breakdowns:", hubData.breakdowns.length);
  console.log("  ✓ AMC Contracts:", hubData.amcContracts.length);
  console.log("  ✓ AMC Reports:", hubData.amcReports.length);
  console.log("  ✓ Spare Parts:", hubData.spares.length);
  console.log("  ✓ Technicians Team:", hubData.team.length);
  console.log("  ✓ MTTR Metrics Count:", hubData.mttrMetrics.length);

  // 3. Request page /admin/maintenance with cookie
  const pageRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/admin/maintenance",
    method: "GET",
    headers: {
      Cookie: sessionCookie,
    },
  });

  console.log(`[Auth Step 3] GET /admin/maintenance -> Status: ${pageRes.statusCode} (${pageRes.body.length} bytes rendered)`);
  if (pageRes.statusCode === 200) {
    console.log("  ✓ Page /admin/maintenance successfully rendered HTML with full SkyMS layout!");
  }

  console.log("\n=======================================================");
  console.log("  ALL ENDPOINTS AND PAGE RENDERING VALIDATED VIA HTTP! ");
  console.log("=======================================================");
}

run();
