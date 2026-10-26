"use client";

import { useCallback, useState } from "react";
import { Clock } from "lucide-react";
import type { Employee } from "@/lib/types";
import EmployeeList from "@/components/EmployeeList";
import TimerControl from "@/components/TimerControl";
import Reports from "@/components/Reports";

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  // Сдвиг ключа после старта/стопа заставляет Reports перезагрузить данные.
  const [reportKey, setReportKey] = useState(0);

  const handleEmployeesLoaded = useCallback((list: Employee[]) => setEmployees(list), []);
  const handleEntriesChanged = useCallback(() => setReportKey((k) => k + 1), []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
        <Clock className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-900">Time Tracker</h1>
      </header>

      {/* 3 колонки на десктопе, 1 колонка на мобильных */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:h-[calc(100vh-3.75rem)] md:grid-cols-3">
        <EmployeeList
          selectedId={selectedId}
          onSelect={setSelectedId}
          onLoaded={handleEmployeesLoaded}
        />
        <TimerControl
          employees={employees}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEntriesChanged={handleEntriesChanged}
        />
        <Reports refreshKey={reportKey} />
      </div>
    </main>
  );
}
