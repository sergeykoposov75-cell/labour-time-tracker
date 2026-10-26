import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// UUID-валидация: пресечёт заведомо некорректные id до обращения к БД.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Некорректный id записи" }, { status: 400 });
  }

  const entry = await prisma.timeEntry.findUnique({ where: { id } });

  if (!entry) {
    return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
  }

  if (entry.endTime) {
    return NextResponse.json({ error: "Таймер уже остановлен" }, { status: 400 });
  }

  // updateMany с условием endTime: null — атомарный «stop exactly once»: два
  // параллельных PATCH не перезапишут время остановки друг друга.
  const stopped = await prisma.timeEntry.updateMany({
    where: { id, endTime: null },
    data: { endTime: new Date() },
  });

  if (stopped.count === 0) {
    return NextResponse.json({ error: "Таймер уже остановлен" }, { status: 400 });
  }

  const updated = await prisma.timeEntry.findUnique({ where: { id }, include: { employee: true } });

  return NextResponse.json(updated);
}
