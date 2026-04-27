import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { env } from "../env.js";
import { PrismaClient } from "../generated/prisma/client.js";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // necessário para Prisma Postgres
  },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  max: 10,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
