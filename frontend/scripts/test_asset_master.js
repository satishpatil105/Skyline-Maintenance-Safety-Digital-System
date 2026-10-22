async function testAssetMaster() {
  console.log("================================================================================");
  console.log("            TESTING ASSET MASTER ADD & SAVE CHANGES WORKFLOW                    ");
  console.log("================================================================================\n");

  // 1. Authenticate as Admin
  console.log("1. Authenticating as Admin (ADM-001)...");
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ADM-001", password: "1234" }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }
  const cookie = loginRes.headers.get("set-cookie");
  console.log("[PASS] Admin logged in successfully.\n");

  // 2. Fetch machines / assets
  console.log("2. Fetching existing machines from /api/admin/machines...");
  const listRes = await fetch("http://localhost:3000/api/admin/machines", {
    headers: { Cookie: cookie },
  });
  const listData = await listRes.json();
  console.log(`[PASS] Fetched ${listData.rows?.length ?? 0} machines.\n`);

  // 3. Add a new asset
  const testAssetId = `TEST-AST-${Date.now().toString().slice(-4)}`;
  console.log(`3. Adding new asset with Asset ID: ${testAssetId}...`);
  const addPayload = {
    id: testAssetId,
    row: {
      "Asset ID": testAssetId,
      "Machine Name": "Precision Laser Cutter Beta",
      "Category": "Laser Cutting",
      "Department": "Production",
      "Location": "Bay Test-1",
      "Make": "Trumpf",
      "Model": "TruLaser 5030",
      "Serial No.": "SN-BETA-7788",
      "Criticality": "High",
      "Responsible Person": "Satish Patil",
      "Status": "Running",
      "PM Frequency": "Monthly",
    },
  };

  const addRes = await fetch("http://localhost:3000/api/admin/machines", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(addPayload),
  });
  const addResult = await addRes.json();
  console.log(`[RESULT] Add machine response: Status ${addRes.status}, Message: "${addResult.message}"`);
  if (!addRes.ok) {
    throw new Error(`Failed to add machine: ${JSON.stringify(addResult)}`);
  }
  console.log("[PASS] New asset added successfully!\n");

  // 4. Verify asset was added and is readable
  console.log("4. Verifying asset is listed in /api/admin/machines...");
  const verifyListRes = await fetch("http://localhost:3000/api/admin/machines", {
    headers: { Cookie: cookie },
  });
  const verifyListData = await verifyListRes.json();
  const found = (verifyListData.rows || []).find((r) => r["Asset ID"] === testAssetId);
  if (!found) {
    throw new Error(`Added asset ${testAssetId} not found in machines list!`);
  }
  console.log(`[PASS] Found asset: "${found["Machine Name"]}" with Status: "${found["Status"]}"\n`);

  // 5. Test "Save Changes" (Editing the asset)
  console.log("5. Testing 'Save Changes' (Editing location, status, and criticality)...");
  const editPayload = {
    id: testAssetId,
    row: {
      ...found,
      "Status": "Under Maintenance",
      "Location": "Bay Maintenance-4",
      "Criticality": "Critical",
      "AMC Vendor": "Trumpf India Service Pvt Ltd",
    },
  };

  const editRes = await fetch("http://localhost:3000/api/admin/machines", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(editPayload),
  });
  const editResult = await editRes.json();
  console.log(`[RESULT] Update machine response: Status ${editRes.status}, Message: "${editResult.message}"`);
  if (!editRes.ok) {
    throw new Error(`Failed to save changes: ${JSON.stringify(editResult)}`);
  }
  console.log("[PASS] Save changes succeeded!\n");

  // 6. Verify changes persisted
  console.log("6. Verifying saved changes in /api/admin/machines...");
  const afterEditRes = await fetch("http://localhost:3000/api/admin/machines", {
    headers: { Cookie: cookie },
  });
  const afterEditData = await afterEditRes.json();
  const updatedItem = (afterEditData.rows || []).find((r) => r["Asset ID"] === testAssetId);
  if (!updatedItem) {
    throw new Error(`Updated asset ${testAssetId} not found!`);
  }
  console.log(`[PASS] Updated Asset Verified:`);
  console.log(`       - Status: ${updatedItem["Status"]} (Expected: Under Maintenance)`);
  console.log(`       - Location: ${updatedItem["Location"]} (Expected: Bay Maintenance-4)`);
  console.log(`       - Criticality: ${updatedItem["Criticality"]} (Expected: Critical)`);
  console.log(`       - AMC Vendor: ${updatedItem["AMC Vendor"]}\n`);

  if (
    updatedItem["Status"] !== "Under Maintenance" ||
    updatedItem["Location"] !== "Bay Maintenance-4" ||
    updatedItem["Criticality"] !== "Critical"
  ) {
    throw new Error("One or more edited fields did not persist correctly!");
  }

  // 7. Cleanup - Delete test asset
  console.log(`7. Cleaning up test asset (${testAssetId})...`);
  const delRes = await fetch(`http://localhost:3000/api/admin/machines?id=${encodeURIComponent(testAssetId)}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  const delResult = await delRes.json();
  console.log(`[RESULT] Delete response: Status ${delRes.status}, Message: "${delResult.message}"`);
  if (!delRes.ok) {
    throw new Error(`Failed to delete test asset: ${JSON.stringify(delResult)}`);
  }
  console.log("[PASS] Test asset cleaned up successfully!\n");

  console.log("================================================================================");
  console.log("      ALL ASSET MASTER TESTS (ADD & SAVE CHANGES) PASSED 100%!                  ");
  console.log("================================================================================");
}

testAssetMaster().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
