import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// GET /api/time-entries — список записей с фильтрацией по датам
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Prisma.TimeEntryWhereInput = {};

  if (startDate || endDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.startTime = dateFilter;
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { employee: true },
    orderBy: { startTime: "desc" },
  });

  return NextResponse.json(entries);
}

// POST /api/time-entries — создание новой записи
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { employeeId, description } = body ?? {};

  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "Необходимо поле employeeId" }, { status: 400 });
  }
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json(
      { error: "Поле description обязательно и должно быть строкой" },
      { status: 400 }
    );
  }

  // Без этой проверки несуществующий employeeId превращается в 500 из-за ошибки FK.
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }

  // Проверяем активную запись у сотрудника
  const active = await prisma.timeEntry.findFirst({
    where: { employeeId, endTime: null },
  });

  if (active) {
    return NextResponse.json(
      { error: "У сотрудника уже запущен таймер" },
      { status: 400 }
    );
  }

  const entry = await prisma.timeEntry.create({
    data: {
      employeeId,
      description: description.trim(),
    },
    include: { employee: true },
  });

  return NextResponse.json(entry, { status: 201 });
}
