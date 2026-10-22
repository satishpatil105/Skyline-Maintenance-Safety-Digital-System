"use client";

import React, { useMemo, useState } from "react";
import type { SparePartItem, TechnicianItem } from "@/lib/maintenanceSystem";

interface SparePartsConsumptionTabProps {
  spares: SparePartItem[];
  technicians: TechnicianItem[];
  machinesList: Array<{ assetId?: string; name?: string; "Asset ID"?: string; "Machine Name"?: string }>;
  onConsumeSpare: (consumption: any) => Promise<void>;
  onRefresh: () => void;
}

export default function SparePartsConsumptionTab({
  spares,
  technicians,
  machinesList,
  onConsumeSpare,
  onRefresh,
}: SparePartsConsumptionTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"All" | "Low Stock" | "Normal">("All");
  const [consumeModalPart, setConsumeModalPart] = useState<SparePartItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [workOrderId, setWorkOrderId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [technician, setTechnician] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredSpares = useMemo(() => {
    return spares.filter((p) => {
      const isLowStock = p.currentStock <= p.minReorderLevel;
      if (stockFilter === "Low Stock" && !isLowStock) return false;
      if (stockFilter === "Normal" && isLowStock) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          p.partId.toLowerCase().includes(q) ||
          p.partName.toLowerCase().includes(q) ||
          p.partNumber.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [spares, stockFilter, searchTerm]);


  const handleOpenConsumeModal = (p: SparePartItem) => {
    setConsumeModalPart(p);
    setQuantity(1);
    setWorkOrderId(`REC-${Date.now().toString().slice(-6)}`);
    setAssetId(machinesList[0]?.assetId || machinesList[0]?.["Asset ID"] || "SKY-001");
    setTechnician(technicians[0]?.name || "Maintenance Technician");
  };

  const handleConfirmConsume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumeModalPart || quantity <= 0) return;

    setIsSubmitting(true);
    try {
      await onConsumeSpare({
        partId: consumeModalPart.partId,
        quantity: Number(quantity),
        workOrderId,
        assetId,
        technician,
        cost: Number(quantity) * consumeModalPart.unitCost,
      });
      setConsumeModalPart(null);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 10: Spare Parts Inventory & Maintenance Consumption
            </h3>
            <p className="text-xs text-slate-500">
              Real-time component stock levels, min reorder alerts, and consumption linked to machine work orders
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div>
            <input
              type="text"
              placeholder="Search part name, part code, bin location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Stock Levels</option>
              <option value="Low Stock">Low Stock Alert (&le; Reorder Level)</option>
              <option value="Normal">Adequate Stock</option>
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStockFilter("All");
              }}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Spares Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-3 px-3">Part ID</th>
                <th className="py-3 px-3">Part Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Applicable Machines</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-right">Reorder Level</th>
                <th className="py-3 px-3 text-right">Unit Cost (₹)</th>
                <th className="py-3 px-3">Storage Location</th>
                <th className="py-3 px-3">Supplier / Vendor</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredSpares.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No spare parts found.
                  </td>
                </tr>
              ) : (
                filteredSpares.map((p) => {
                  const isLow = p.currentStock <= p.minReorderLevel;
                  return (
                    <tr key={p.partId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {p.partId}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{p.partName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{p.partNumber}</div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                          {p.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate text-slate-600">
                        {p.applicableMachines?.join(", ") || "All Machines"}
                      </td>

                      <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                        <span className={isLow ? "text-red-700 font-black text-sm" : "text-slate-900"}>
                          {p.currentStock} {p.unit}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">
                        {p.minReorderLevel} {p.unit}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{p.unitCost.toLocaleString("en-IN")}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {p.location}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 truncate max-w-xs">
                        {p.supplierName}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isLow
                              ? "bg-red-50 text-red-800 border-red-300 animate-pulse"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {isLow ? "Reorder Alert" : "In Stock"}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenConsumeModal(p)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1"
                        >
                          Log Use
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consume Modal */}
      {consumeModalPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmConsume}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Log Spare Part Consumption
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  {consumeModalPart.partName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setConsumeModalPart(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block text-[10px]">Available In Stock</span>
                  <span className="font-black text-slate-900 text-sm">
                    {consumeModalPart.currentStock} {consumeModalPart.unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Unit Cost</span>
                  <span className="font-bold text-slate-900">₹{consumeModalPart.unitCost}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Quantity Consumed ({consumeModalPart.unit}) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={consumeModalPart.currentStock}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Target Machine
                </label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {machinesList.map((m) => {
                    const id = m.assetId || m["Asset ID"] || "";
                    const name = m.name || m["Machine Name"] || id;
                    return (
                      <option key={id} value={id}>
                        {name} ({id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Linked Work Order / Record ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. REC-1024-01"
                  value={workOrderId}
                  onChange={(e) => setWorkOrderId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Issued Technician
                </label>
                <select
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {technicians.map((t) => (
                    <option key={t.userId} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConsumeModalPart(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || quantity > consumeModalPart.currentStock}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? "Deducting..." : "Confirm Consumption"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
