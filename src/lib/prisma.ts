import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient: в dev-режиме Next.js перезапускает модули при каждой
// пересборке, без глобального кэша это быстро исчерпает пул соединений SQLite.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
