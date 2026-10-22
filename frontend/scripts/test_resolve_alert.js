const http = require("http");

async function testResolve() {
  const loginData = JSON.stringify({
    email: "mrsatishpatil105@gmail.com",
    password: "1234",
  });

  const loginReq = http.request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(loginData),
      },
    },
    (res) => {
      const cookie = res.headers["set-cookie"]?.[0]?.split(";")[0];
      console.log("Login status:", res.statusCode);

      // 1. Fetch alerts
      const fetchReq = http.request(
        {
          hostname: "localhost",
          port: 3000,
          path: "/api/notifications",
          method: "GET",
          headers: { Cookie: cookie || "" },
        },
        (fres) => {
          let fbody = "";
          fres.on("data", (d) => (fbody += d));
          fres.on("end", () => {
            const data = JSON.parse(fbody);
            console.log("Initial counts:", JSON.stringify(data.counts));
            const alertToClose = data.alerts?.[0];
            if (!alertToClose) {
              console.log("No alerts to close!");
              return;
            }
            console.log("Closing alert:", alertToClose.id, alertToClose.type, alertToClose.machine);

            // 2. Close alert
            const closeData = JSON.stringify({ action: "close", id: alertToClose.id });
            const closeReq = http.request(
              {
                hostname: "localhost",
                port: 3000,
                path: "/api/notifications",
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(closeData),
                  Cookie: cookie || "",
                },
              },
              (cres) => {
                let cbody = "";
                cres.on("data", (d) => (cbody += d));
                cres.on("end", () => {
                  console.log("Close response status:", cres.statusCode, cbody);

                  // 3. Re-fetch alerts to verify count decreased
                  const verifyReq = http.request(
                    {
                      hostname: "localhost",
                      port: 3000,
                      path: "/api/notifications",
                      method: "GET",
                      headers: { Cookie: cookie || "" },
                    },
                    (vres) => {
                      let vbody = "";
                      vres.on("data", (d) => (vbody += d));
                      vres.on("end", () => {
                        const vdata = JSON.parse(vbody);
                        console.log("After close counts:", JSON.stringify(vdata.counts));
                        const stillExists = vdata.alerts?.some((a) => a.id === alertToClose.id);
                        console.log("Closed alert still in active list?", stillExists ? "YES (FAIL)" : "NO (RESOLVED SUCCESS)");
                      });
                    }
                  );
                  verifyReq.end();
                });
              }
            );
            closeReq.write(closeData);
            closeReq.end();
          });
        }
      );
      fetchReq.end();
    }
  );

  loginReq.write(loginData);
  loginReq.end();
}

testResolve().catch(console.error);
