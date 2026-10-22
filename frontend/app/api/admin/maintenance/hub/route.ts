import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import {
  fetchMaintenanceDashboardStats,
  fetchMaintenanceRequests,
  fetchMaintenanceRecords,
  fetchPMSchedules,
  fetchBreakdownRecords,
  fetchAMCContracts,
  fetchSpareParts,
  fetchTechnicianTeam,
  calculateMTTRMTBFMetrics,
  createMaintenanceRequest,
  assignMaintenanceRequest,
  startWorkOnRequest,
  putRequestOnHold,
  cancelOrRejectRequest,
  completeMaintenanceRequest,
  reopenMaintenanceRequest,
  submitWorkEntryRecord,
  verifyMaintenanceRecord,
  createPMScheduleItem,
  completePMScheduleTask,
  createBreakdownRecord,
  createAMCContractRecord,
  createAMCServiceReportRecord,
  recordSparePartConsumption,
  deleteMaintenanceRecordItem,
  deletePMScheduleItem,
} from "@/lib/maintenanceSystem";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/maintenance/hub
 * Fetches unified live MongoDB-backed data for all 13 Maintenance submodules.
 */
export const GET = safe(async (request: NextRequest) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const [
    stats,
    requests,
    records,
    pmSchedules,
    breakdowns,
    amc,
    spares,
    team,
    mttrMetrics,
  ] = await Promise.all([
    fetchMaintenanceDashboardStats(),
    fetchMaintenanceRequests(),
    fetchMaintenanceRecords(),
    fetchPMSchedules(),
    fetchBreakdownRecords(),
    fetchAMCContracts(),
    fetchSpareParts(),
    fetchTechnicianTeam(),
    calculateMTTRMTBFMetrics(),
  ]);

  return NextResponse.json({
    success: true,
    stats,
    requests,
    records,
    pmSchedules,
    breakdowns,
    amcContracts: amc.contracts,
    amcReports: amc.reports,
    spares,
    team,
    mttrMetrics,
  });
});

/**
 * POST /api/admin/maintenance/hub
 * Handles actions for Workflows B, C, D and submodules with role authorization.
 */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || !body.action) {
    return NextResponse.json(
      { success: false, message: "Action parameter is required." },
      { status: 400 }
    );
  }

  const { action } = body;
  const user = auth.user;

  try {
    switch (action) {
      // 1. Create Maintenance Request
      case "create_request": {
        const reqData = body.requestData || body;
        if (!reqData.assetId || !reqData.problem) {
          return NextResponse.json(
            { success: false, message: "Asset ID and Problem Description are required." },
            { status: 400 }
          );
        }
        const res = await createMaintenanceRequest(reqData, user);
        return NextResponse.json(res);
      }

      // 2. Assign Technician & Update Priority / Target Date
      case "assign_request": {
        const { requestId, technicianName, priority, targetDate } = body;
        if (!requestId || !technicianName) {
          return NextResponse.json(
            { success: false, message: "Request ID and Technician Name are required." },
            { status: 400 }
          );
        }
        const res = await assignMaintenanceRequest(requestId, technicianName, priority, targetDate, user);
        return NextResponse.json(res);
      }

      // 3. Start Work on Maintenance Request
      case "start_work": {
        const { requestId } = body;
        if (!requestId) {
          return NextResponse.json(
            { success: false, message: "Request ID is required to start work." },
            { status: 400 }
          );
        }
        const res = await startWorkOnRequest(requestId, user);
        return NextResponse.json(res);
      }

      // 4. Put Request on Hold
      case "put_on_hold": {
        const { requestId, reason } = body;
        if (!requestId) {
          return NextResponse.json(
            { success: false, message: "Request ID is required to put on hold." },
            { status: 400 }
          );
        }
        const res = await putRequestOnHold(requestId, reason || "Parts or authorization awaiting", user);
        return NextResponse.json(res);
      }

      // 5. Cancel or Reject Request
      case "cancel_request": {
        const { requestId, reason, status } = body;
        if (!requestId) {
          return NextResponse.json(
            { success: false, message: "Request ID is required." },
            { status: 400 }
          );
        }
        const res = await cancelOrRejectRequest(requestId, reason || "Cancelled", status || "Cancelled", user);
        return NextResponse.json(res);
      }

      // 6. Complete Maintenance Request (Primary Workflow Action)
      case "complete_request": {
        const completionData = body.completionData || body.workData || body;
        if (!completionData.requestId) {
          return NextResponse.json(
            { success: false, message: "Request ID is required." },
            { status: 400 }
          );
        }
        const res = await completeMaintenanceRequest(completionData, user);
        return NextResponse.json(res);
      }

      // Workflow C backwards-compatibility: Technician Work Entry
      case "work_entry": {
        const workData = body.workData || body;
        const res = await submitWorkEntryRecord(workData, user);
        return NextResponse.json(res);
      }

      // Reopen Completed Request
      case "reopen_request": {
        const { requestId, reason } = body;
        if (!requestId) {
          return NextResponse.json(
            { success: false, message: "Request ID is required to reopen." },
            { status: 400 }
          );
        }
        const res = await reopenMaintenanceRequest(requestId, reason || "Reopened for maintenance check", user);
        return NextResponse.json(res);
      }

      // Workflow D: Supervisor Verification & Final Record
      case "verify_work": {
        // Enforce Supervisor or Admin permission for verification
        const userRole = (user.role || "").toLowerCase();
        if (userRole !== "admin" && userRole !== "supervisor") {
          return NextResponse.json(
            { success: false, message: "Unauthorized: Only Supervisors or Admins can verify completed maintenance work." },
            { status: 403 }
          );
        }

        const { recordId, decision, remarks, safetyReleaseAuthorized } = body;
        if (!recordId || !decision) {
          return NextResponse.json(
            { success: false, message: "Record ID and verification decision are required." },
            { status: 400 }
          );
        }

        const res = await verifyMaintenanceRecord(
          recordId,
          decision,
          remarks || "",
          Boolean(safetyReleaseAuthorized),
          user
        );
        return NextResponse.json(res);
      }

      // Preventive Maintenance: Create PM Schedule
      case "create_pm": {
        const { schedule } = body;
        if (!schedule || !schedule.assetId || !schedule.taskTitle || !schedule.frequency || !schedule.nextDueDate) {
          return NextResponse.json(
            { success: false, message: "Asset, Task Title, Frequency, and Next Due Date are required." },
            { status: 400 }
          );
        }
        const res = await createPMScheduleItem(schedule, user);
        return NextResponse.json(res);
      }

      // Preventive Maintenance: Complete PM Task
      case "complete_pm": {
        const { scheduleId, details } = body;
        if (!scheduleId) {
          return NextResponse.json(
            { success: false, message: "Schedule ID is required." },
            { status: 400 }
          );
        }
        const res = await completePMScheduleTask(scheduleId, details || {}, user);
        return NextResponse.json(res);
      }

      // Breakdown Register: Log New Breakdown
      case "create_breakdown": {
        const { breakdown } = body;
        if (!breakdown || !breakdown.assetId || !breakdown.problemDescription) {
          return NextResponse.json(
            { success: false, message: "Asset ID and Problem Description are required." },
            { status: 400 }
          );
        }
        const res = await createBreakdownRecord(breakdown, user);
        return NextResponse.json(res);
      }

      // AMC Contracts: Register New AMC Contract
      case "create_amc_contract": {
        const { contract } = body;
        if (!contract || !contract.serviceProvider || !contract.startDate || !contract.expiryDate) {
          return NextResponse.json(
            { success: false, message: "Service Provider, Start Date, and Expiry Date are required." },
            { status: 400 }
          );
        }
        const res = await createAMCContractRecord(contract);
        return NextResponse.json(res);
      }

      // AMC Service Reports: Record Service Visit
      case "create_amc_report": {
        const { report } = body;
        if (!report || !report.contractId || !report.assetId || !report.serviceDate) {
          return NextResponse.json(
            { success: false, message: "Contract ID, Asset ID, and Service Date are required." },
            { status: 400 }
          );
        }
        const res = await createAMCServiceReportRecord(report);
        return NextResponse.json(res);
      }

      // Spare Parts: Log Consumption
      case "consume_spare": {
        const { consumption } = body;
        if (!consumption || !consumption.partId || !consumption.quantity || !consumption.workOrderId) {
          return NextResponse.json(
            { success: false, message: "Part ID, Quantity, and Work Order ID are required." },
            { status: 400 }
          );
        }
        const res = await recordSparePartConsumption(consumption);
        return NextResponse.json(res);
      }

      // Maintenance Records: Delete Record
      case "delete_record": {
        const { recordId } = body;
        if (!recordId) {
          return NextResponse.json(
            { success: false, message: "Record ID is required." },
            { status: 400 }
          );
        }
        const res = await deleteMaintenanceRecordItem(recordId);
        return NextResponse.json(res);
      }

      // Preventive Maintenance: Delete PM Schedule
      case "delete_pm": {
        const { scheduleId } = body;
        if (!scheduleId) {
          return NextResponse.json(
            { success: false, message: "Schedule ID is required." },
            { status: 400 }
          );
        }
        const res = await deletePMScheduleItem(scheduleId);
        return NextResponse.json(res);
      }

      default:
        return NextResponse.json(
          { success: false, message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error(`[MaintenanceHub API Error - ${action}]:`, err);
    return NextResponse.json(
      { success: false, message: err.message || "An unexpected error occurred during operation." },
      { status: 500 }
    );
  }
});
