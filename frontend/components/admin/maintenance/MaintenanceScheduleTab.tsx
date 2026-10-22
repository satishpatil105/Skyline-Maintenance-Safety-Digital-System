"use client";

import React, { useMemo, useState } from "react";
import type { PMScheduleItem, AMCContractItem, MaintenanceRequest } from "@/lib/maintenanceSystem";

interface MaintenanceScheduleTabProps {
  pmSchedules: PMScheduleItem[];
  amcContracts: AMCContractItem[];
  requests: MaintenanceRequest[];
}

export default function MaintenanceScheduleTab({
  pmSchedules,
  amcContracts,
  requests,
}: MaintenanceScheduleTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 1)); // October 2026
  const [selectedDay, setSelectedDay] = useState<number | null>(15);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  // Calendar matrix calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

  // Group events by day of month (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = new Map<number, Array<{ id: string; title: string; type: "PM" | "AMC" | "REQ"; machine: string }>>();

    const currentPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

    pmSchedules.forEach((p) => {
      if (p.nextDueDate && p.nextDueDate.startsWith(currentPrefix)) {
        const day = parseInt(p.nextDueDate.slice(8, 10), 10);
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push({
          id: p.scheduleId,
          title: p.taskTitle,
          type: "PM",
          machine: p.machineName,
        });
      }
    });

    requests
      .filter((r) => r.status !== "Closed")
      .forEach((r) => {
        if (r.reportedDate && r.reportedDate.startsWith(currentPrefix)) {
          const day = parseInt(r.reportedDate.slice(8, 10), 10);
          if (!map.has(day)) map.set(day, []);
          map.get(day)!.push({
            id: r.requestId,
            title: r.problem,
            type: "REQ",
            machine: r.machineName,
          });
        }
      });

    return map;
  }, [pmSchedules, requests, year, month]);

  const selectedDayEvents = selectedDay ? eventsByDay.get(selectedDay) || [] : [];


  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Section 11: Maintenance Schedule & Interactive Calendar
          </h3>
          <p className="text-xs text-slate-500">
            Plant-wide timetable for preventive inspections, planned shutdown tasks, and AMC visits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer text-xs font-bold"
            >
              &larr; Prev
            </button>
            <span className="px-3 text-xs font-bold text-slate-900">
              {monthName} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer text-xs font-bold"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Grid Layout: Calendar + Side Inspection Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Monthly Calendar Grid */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 uppercase tracking-wider mb-2">
            <span className="text-red-600">Sun (Off)</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {/* Blank cells before 1st of month */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-20 bg-slate-50/50 rounded-xl border border-dashed border-slate-100"></div>
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isSelected = selectedDay === day;
              const dayEvents = eventsByDay.get(day) || [];
              const dayOfWeek = (firstDayIndex + idx) % 7;
              const isSunday = dayOfWeek === 0;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`h-22 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-[#880b13] bg-[#880b13]/5 ring-2 ring-[#880b13]/20 shadow-xs"
                      : isSunday
                      ? "bg-slate-50 border-slate-200 text-slate-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-bold ${isSelected ? "text-[#880b13]" : isSunday ? "text-slate-400" : "text-slate-800"}`}>
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#880b13] text-white text-[9px] font-bold flex items-center justify-center">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Badges preview */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev, i) => (
                      <div
                        key={i}
                        className={`text-[9px] px-1 py-0.5 rounded-sm truncate font-semibold ${
                          ev.type === "PM"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {ev.type}: {ev.machine.split(" ")[0]}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-bold block">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda Side Pane */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h4 className="text-sm font-bold text-slate-900">
                Scheduled Timetable
              </h4>
              <span className="text-xs font-bold text-[#880b13]">
                {selectedDay ? `${monthName} ${selectedDay}, ${year}` : "Select a date"}
              </span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No maintenance tasks or visits scheduled on this date.
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDayEvents.map((ev, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                          ev.type === "PM"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ev.type === "PM" ? "Preventive Maintenance" : "Work Order Request"}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 font-bold">
                        {ev.id}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-xs">
                      {ev.machine}
                    </div>

                    <p className="text-slate-600 text-[11px] leading-snug">
                      {ev.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Factory operating hours: 9:00 AM – 8:00 PM (Monday – Saturday). Factory is closed on Sundays (Weekly Off).
          </div>
        </div>
      </div>
    </div>
  );
}
