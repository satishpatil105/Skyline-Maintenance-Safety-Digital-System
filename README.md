# 🏭 Skyline ERP — Industrial Maintenance & Safety Digital System

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Next.js%2014%20%7C%20React%2018-blue?style=for-the-badge&logo=next.js"/>
  <img src="https://img.shields.io/badge/Backend-Node.js%20%7C%20TypeScript-green?style=for-the-badge&logo=node.js"/>
  <img src="https://img.shields.io/badge/Database-MongoDB%20Atlas%20%7C%20JSON%20Engine-orange?style=for-the-badge&logo=mongodb"/>
  <img src="https://img.shields.io/badge/Security-RBAC%20%7C%20Zero--Secret%20Sanitized-red?style=for-the-badge&logo=json-web-tokens"/>
  <img src="https://img.shields.io/badge/Industrial-5S%20%26%20HIRA%20Audits-purple?style=for-the-badge"/>
</p>

---

## 🌟 Introduction

**Skyline Maintenance & Safety Digital System** is an enterprise-grade ERP workstation portal engineered for high-precision industrial manufacturing facilities. The platform bridges the operational gap between **Factory Floor Operators**, **Maintenance Supervisors**, and **Executive Administrators**, providing real-time data scoping, machine-specific inspection checklists, 5S compliance auditing, and emergency breakdown management.

Designed specifically for heavy industrial environments — including Laser Cutting, Turret Punching, CNC Shearing, Bending, Air Compressors, EOT Cranes, CO2 Welding, and Powder Coating Ovens — the system digitizes paper logs into a high-performance, audit-ready operational dashboard.

---

## 🚀 System Workstation Flow

1. **Role-Based Workstation Entry**: Strict dynamic routing directs Operators, Supervisors, and Administrators to their dedicated control centers.
2. **Machine-Specific Inspection**: Operators access dynamically scoped machine portals (e.g., Laser Cutting, CNC Shearing) to perform daily 5S and operational checklists.
3. **Real-Time Verification & Audit**: Inspection logs and breakdown reports flow directly to Supervisor control hubs for instant review and maintenance dispatch.
4. **Administrative Command & Analytics**: Administrators monitor plant-wide equipment status, manage master data, and track safety metrics across all 18 industrial modules.

---

## 🔥 Core Capabilities & Feature Matrix

| Module / Feature | Technical & Operational Description |
| :--- | :--- |
| 🚜 **Operator Workstation** | Scoped, table-first interface for plant operators to execute daily machine checklists and report breakdowns without administrative friction. |
| 🛠️ **Supervisor Control Center** | Centralized hub to audit inspection submissions, assign maintenance tasks, monitor 5S scores, and track machine downtime. |
| 👑 **Administrator Command Center** | Full-scale CRUD management across all 18 industrial master modules with dynamic schema validation and Excel/MongoDB synchronization. |
| 📋 **Checklist Master Engine** | Over 220 pre-configured industrial inspection checkpoints covering 16 machine categories and 5S standards. |
| 🦺 **Safety & HIRA Audit Suite** | Digital audit logs for Hazard Identification, Risk Assessment (HIRA), Fire Safety compliance, and EHS reporting. |
| ⚡ **Resilient Dual-Data Engine** | MongoDB Atlas primary persistence with automated local JSON fallback ensuring uninterrupted factory floor uptime. |

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 14 (App Router) + React 18 + Tailwind CSS + Lucide Icons
* **Backend**: Node.js & Express API Routes + TypeScript + ExcelJS Data Engine
* **Database & Persistence**: MongoDB (MongoClient/Mongoose) + Local JSON Fallback Store
* **Security & Auth**: Role-Based Access Control (RBAC), Environment Secret Isolation (`process.env.MONGODB_URI`), Input Sanitation

---

## 📂 Architecture Overview

```text
Skyline Maintenance & Safety Digital System/
 ├── frontend/                # Next.js App Router UI & Workstation Portals
 │    ├── app/                # Route Groups (admin/, supervisor/, operator/)
 │    ├── components/         # Workstation & Shared React UI Components
 │    ├── lib/                # Database Handlers, Stores & Utilities
 │    └── public/             # Industrial Assets & Badges
 ├── backend/                 # Backend API Services & Data Orchestration
 │    ├── api/                # RESTful API Route Handlers
 │    ├── lib/                # MongoDB Drivers & Master Checklist Utilities
 │    ├── scripts/            # Database Seeding & Migration Scripts
 │    └── data/               # Master Schemas & Local Storage Engine
 └── .gitignore               # Environment Secret & Cache Isolation Rules
```

---

## 🛡️ Enterprise Security & Data Integrity

* **Zero-Secret Codebase**: Environment variable isolation ensures database credentials (`MONGODB_URI`, `AUTH_SECRET`) are never exposed in source control.
* **Role Scoping & Isolation**: Strict route guards prevent unauthorized access across Operator, Supervisor, and Administrator boundaries.
* **Fault-Tolerant Persistence**: Dual-layer architecture guarantees zero data loss during network or database connectivity disruptions.
* **Audit Compliance**: All machine inspections, breakdowns, and safety audits maintain immutable timestamped records for regulatory compliance.

---

<div align="center">

**Skyline Project & Engineers Pvt. Ltd.**  
*Digitizing Industrial Operations & Elevating Safety Standards*

</div>
