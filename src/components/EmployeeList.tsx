"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, TriangleAlert, UserPlus, Users } from "lucide-react";
import type { Employee } from "@/lib/types";

interface EmployeeListProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onLoaded?: (employees: Employee[]) => void;
}

export default function EmployeeList({ selectedId, onSelect, onLoaded }: EmployeeListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Колбэк родителя держим в ref: иначе нестабильная функция-проп пересоздавала
  // loadEmployees и вызывала бесконечную повторную загрузку списка.
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employees", { cache: "no-store" });
      if (!res.ok) throw new Error(`Не удалось загрузить сотрудников (${res.status})`);
      const data: Employee[] = await res.json();
      setEmployees(data);
      onLoadedRef.current?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить сотрудников");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не удалось добавить сотрудника");

      const next = [data as Employee, ...employees];
      setEmployees(next);
      onLoaded?.(next);
      setName("");
      if (!selectedId) onSelect(data.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Не удалось добавить сотрудника");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Users className="h-5 w-5 text-blue-600" />
        Сотрудники
      </h2>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя сотрудника"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Добавить
        </button>
      </form>

      {createError && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {createError}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка сотрудников…
        </p>
      ) : error ? (
        <div className="flex flex-col items-start gap-2 py-4">
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
          <button
            onClick={() => void loadEmployees()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Повторить
          </button>
        </div>
      ) : employees.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">
          Сотрудников пока нет — добавьте первого, чтобы начать учёт времени.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {employees.map((employee) => {
            const active = employee.id === selectedId;
            return (
              <li key={employee.id}>
                <button
                  type="button"
                  onClick={() => onSelect(employee.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-200"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {employee.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
