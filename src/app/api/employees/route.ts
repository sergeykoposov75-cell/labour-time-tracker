import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/employees — список всех сотрудников
export async function GET() {
  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(employees);
}

// POST /api/employees — создание сотрудника
export async function POST(req: Request) {
  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Поле 'name' обязательно и должно быть строкой" },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.create({
    data: { name: name.trim() },
  });
  return NextResponse.json(employee, { status: 201 });
}
