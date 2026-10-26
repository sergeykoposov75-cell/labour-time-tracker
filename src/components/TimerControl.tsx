"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Square, TriangleAlert } from "lucide-react";
import { format } from "date-fns";
import type { Employee, TimeEntry } from "@/lib/types";

interface TimerControlProps {
  employees: Employee[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Вызывается после удачных старта/стопа, чтобы родитель обновил смежные панели. */
  onEntriesChanged?: () => void;
}

/** Извлекает текст ошибки из ответа API, если тело не JSON — отдаёт запасной вариант. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") return data.error;
  } catch {
    // тело ответа не JSON — используем fallback
  }
  return fallback;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export default function TimerControl({
  employees,
  selectedId,
  onSelect,
  onEntriesChanged,
}: TimerControlProps) {
  const [description, setDescription] = useState("");
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Активная запись берётся из общих записей: API отдаёт и те, у которых endTime === null.
  const loadActiveEntry = useCallback(async () => {
    if (!selectedId) {
      setActiveEntry(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/time-entries", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, `Не удалось загрузить таймер (${res.status})`));
      const entries: TimeEntry[] = await res.json();
      setActiveEntry(entries.find((e) => e.employeeId === selectedId && e.endTime === null) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить таймер");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadActiveEntry();
  }, [loadActiveEntry]);

  // Тикающий счётчик: пока есть активная запись, пересчитываем прошедшее время раз в секунду.
  useEffect(() => {
    if (!activeEntry) {
      setElapsedMs(0);
      return;
    }
    const start = new Date(activeEntry.startTime).getTime();
    const tick = () => setElapsedMs(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  const selectedEmployee = employees.find((e) => e.id === selectedId);
  const running = Boolean(activeEntry);

  async function handleStart() {
    if (!selectedEmployee || !description.trim() || running || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee.id, description: description.trim() }),
      });
      if (!res.ok) throw new Error(await readError(res, "Не удалось запустить таймер"));
      const entry: TimeEntry = await res.json();
      setActiveEntry(entry);
      setDescription("");
      onEntriesChanged?.();
    } catch (e) {
      // Здесь же показываем ответ сервера «У сотрудника уже запущен таймер».
      setError(e instanceof Error ? e.message : "Не удалось запустить таймер");
      void loadActiveEntry();
    } finally {
      setSaving(false);
    }
  }

  async function handleStop() {
    if (!activeEntry || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/time-entries/${activeEntry.id}/stop`, { method: "PATCH" });
      if (!res.ok) throw new Error(await readError(res, "Не удалось остановить таймер"));
      await res.json();
      setActiveEntry(null);
      onEntriesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось остановить таймер");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Play className="h-5 w-5 text-blue-600" />
        Таймер
      </h2>

      <label className="flex flex-col gap-1.5 text-sm text-slate-600">
        Сотрудник
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          disabled={running}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">— выберите сотрудника —</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-slate-600">
        Описание задачи
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={running}
          placeholder="Над чем работаем?"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          running
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Проверка активного таймера…
          </span>
        ) : activeEntry ? (
          <>
            <p className="font-medium">Идёт работа: {activeEntry.description}</p>
            <p className="mt-1 font-mono text-3xl tabular-nums">{formatElapsed(elapsedMs)}</p>
            <p className="mt-1 text-xs">
              Запущен в {format(new Date(activeEntry.startTime), "dd.MM.yyyy HH:mm")} ·{" "}
              {selectedEmployee?.name}
            </p>
          </>
        ) : (
          <p>
            {selectedEmployee
              ? "Таймер остановлен — можно запустить новую задачу."
              : "Выберите сотрудника, чтобы запустить таймер."}
          </p>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={running || saving || !selectedEmployee || !description.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {saving && !running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Старт
        </button>
        <button
          type="button"
          onClick={() => void handleStop()}
          disabled={!running || saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {saving && running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          Остановить
        </button>
      </div>
    </section>
  );
}
