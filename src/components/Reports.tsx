"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { differenceInSeconds, endOfWeek, format, startOfWeek } from "date-fns";
import { ChartColumn, Inbox, Loader2, TriangleAlert } from "lucide-react";
import type { TimeEntry } from "@/lib/types";

interface ReportsProps {
  // Изменение ключа (старт/стоп таймера) перезагружает отчёт с текущим периодом.
  refreshKey?: number;
}

const DATE_INPUT = "yyyy-MM-dd";

function currentWeek(): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(startOfWeek(now, { weekStartsOn: 1 }), DATE_INPUT),
    to: format(endOfWeek(now, { weekStartsOn: 1 }), DATE_INPUT),
  };
}

// Для активной записи (endTime === null) считаем время до текущего момента —
// так «в процессе» не ломает суммарную статистику.
function entryDurationMs(entry: TimeEntry, now: number): number {
  const end = entry.endTime ? new Date(entry.endTime) : new Date(now);
  return Math.max(0, differenceInSeconds(end, new Date(entry.startTime)) * 1000);
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s} с`;
  return `${s} с`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") return data.error;
  } catch {
    // тело ответа не JSON — используем запасной вариант
  }
  return fallback;
}

export default function Reports({ refreshKey = 0 }: ReportsProps) {
  const week = useRef(currentWeek());
  const [from, setFrom] = useState(week.current.from);
  const [to, setTo] = useState(week.current.to);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Держим актуальные даты в ref, чтобы load() не зависел от state и не пересоздавался на каждый ввод.
  const periodRef = useRef({ from, to });
  periodRef.current = { from, to };

  const load = useCallback(async () => {
    const { from: f, to: t } = periodRef.current;
    if (!f || !t) {
      setFormError("Укажите обе даты периода");
      return;
    }
    const start = new Date(`${f}T00:00:00`);
    const end = new Date(`${t}T23:59:59.999`);
    if (start > end) {
      setFormError("Дата начала не может быть позже даты окончания");
      return;
    }
    setFormError(null);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      const res = await fetch(`/api/time-entries?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, `Не удалось загрузить отчёт (${res.status})`));
      const data: TimeEntry[] = await res.json();
      setEntries(data);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить отчёт");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [refreshKey, load]);

  const hasActive = entries.some((e) => !e.endTime);

  // Если в выборке есть незавершённые записи, их длительность «тикает» раз в минуту.
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [hasActive]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  const totals = useMemo(() => {
    const map = new Map<string, { name: string; ms: number; count: number; hasActive: boolean }>();
    for (const entry of entries) {
      const row =
        map.get(entry.employeeId) ??
        { name: entry.employee?.name ?? "Без имени", ms: 0, count: 0, hasActive: false };
      row.ms += entryDurationMs(entry, now);
      row.count += 1;
      if (!entry.endTime) row.hasActive = true;
      map.set(entry.employeeId, row);
    }
    return [...map.values()].sort((a, b) => b.ms - a.ms);
  }, [entries, now]);

  const grandTotalMs = useMemo(() => totals.reduce((sum, t) => sum + t.ms, 0), [totals]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <ChartColumn className="h-5 w-5 text-blue-600" />
        Отчёты
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          С даты
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          По дату
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Сформировать отчет
        </button>
      </form>

      {formError && (
        <p className="flex items-center gap-1.5 text-sm text-amber-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {formError}
        </p>
      )}

      {error ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : loading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Формирование отчёта…
        </p>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Inbox className="h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">За выбранный период записей нет</p>
          <p className="text-sm text-slate-400">Измените период или запустите таймер — записи появятся здесь.</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Сотрудник</th>
                  <th className="px-3 py-2 font-medium">Задача</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Начало</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Конец</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Длительность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className={entry.endTime ? "" : "bg-amber-50"}>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {entry.employee?.name ?? "Без имени"}
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-slate-600" title={entry.description}>
                      {entry.description}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-slate-600">
                      {format(new Date(entry.startTime), "dd.MM.yyyy HH:mm")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-slate-600">
                      {entry.endTime ? (
                        format(new Date(entry.endTime), "dd.MM.yyyy HH:mm")
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-sans text-xs font-medium text-amber-700">
                          В процессе
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums text-slate-800">
                      {formatDuration(entryDurationMs(entry, now))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
              <span>Итог по сотрудникам</span>
              <span className="font-mono tabular-nums">{formatDuration(grandTotalMs)}</span>
            </div>
            {totals.map((row) => (
              <div key={row.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {row.name}
                  {row.hasActive && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      В процессе
                    </span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatDuration(row.ms)} · {row.count} {row.count === 1 ? "запись" : "записей"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
