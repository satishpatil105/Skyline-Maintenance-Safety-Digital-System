async function testPatch() {
  console.log("Testing PATCH /api/hira/1 ...");
  
  // Test updating status and remarks
  const res = await fetch("http://localhost:3000/api/hira/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionStatus: "In Progress",
      progressRemarks: "Hydraulic trolley vendor quotation requested.",
      targetDate: "2026-10-30",
    }),
  });

  console.log("PATCH status:", res.status);
  const data = await res.json();
  console.log("PATCH response:", data.success, data.message);
  console.log("Updated record actionStatus:", data.record?.actionStatus);
  console.log("Updated audit trail count:", data.record?.actionTracking?.auditTrail?.length);
  console.log("Latest audit trail entry:", data.record?.actionTracking?.auditTrail?.slice(-1)[0]);

  // Re-check GET /api/hira to ensure summary reflects in-progress count
  const resGet = await fetch("http://localhost:3000/api/hira");
  const dataGet = await resGet.json();
  console.log("New Action Status Counts:", dataGet.summary?.actionStatusCounts);

  // Restore back to "Open" for pristine testing state
  await fetch("http://localhost:3000/api/hira/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionStatus: "Open",
      progressRemarks: "Initial open state restored.",
      targetDate: null,
    }),
  });
  console.log("Restored back to Open!");
}

testPatch().catch(console.error);
