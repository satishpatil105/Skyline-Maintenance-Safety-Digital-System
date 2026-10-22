const http = require("http");

async function test() {
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
      console.log("Login status:", res.statusCode, "Cookie present:", !!cookie);

      const notifReq = http.request(
        {
          hostname: "localhost",
          port: 3000,
          path: "/api/notifications?sync=true",
          method: "GET",
          headers: {
            Cookie: cookie || "",
          },
        },
        (nres) => {
          let body = "";
          nres.on("data", (d) => (body += d));
          nres.on("end", () => {
            console.log("Notifications status:", nres.statusCode);
            try {
              const j = JSON.parse(body);
              console.log("SUCCESS:", j.success);
              console.log("COUNTS:", JSON.stringify(j.counts));
              console.log(
                "Total alerts:",
                j.alerts?.length,
                "Due:",
                j.due?.length,
                "Pending:",
                j.pending?.length,
                "Upcoming:",
                j.upcoming?.length
              );
              if (j.alerts && j.alerts.length > 0) {
                console.log("\n=== ALL ACTIVE ALERTS ===");
                j.alerts.forEach((a, idx) => {
                  console.log(`[#${idx + 1}] ID: ${a.id} | Cat: ${a.categoryType} | Type: ${a.type} | Machine: ${a.machine} | Status: ${a.status} | DaysLeft: ${a.daysLeft} | DueDate: ${a.dueDate}`);
                });
              }
            } catch (e) {
              console.log("Parse error:", e.message, body.slice(0, 300));
            }
          });
        }
      );
      notifReq.end();
    }
  );

  loginReq.write(loginData);
  loginReq.end();
}

test();
