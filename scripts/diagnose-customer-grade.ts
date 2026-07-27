import { Pool } from "pg";
import { prisma } from "../lib/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const columns = await pool.query(
    `SELECT column_name, data_type, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'Customer'
     ORDER BY ordinal_position`
  );
  const migrations = await pool
    .query(
      `SELECT migration_name, finished_at
       FROM "_prisma_migrations"
       ORDER BY started_at DESC
       LIMIT 10`
    )
    .catch((error: Error) => ({ rows: [{ error: error.message }] }));
  const customers = await pool
    .query(`SELECT id, code, name, grade FROM "Customer" ORDER BY id DESC LIMIT 3`)
    .catch((error: Error) => ({ rows: [{ error: error.message }] }));
  const firstCustomer = customers.rows[0] as { id?: number; grade?: string };
  const updateCheck =
    firstCustomer?.id == null
      ? { skipped: "no customer" }
      : await prisma.customer.update({
          where: { id: firstCustomer.id },
          data: { grade: firstCustomer.grade || "D" },
          select: { id: true, code: true, grade: true },
        });

  console.log(
    JSON.stringify(
      {
        columns: columns.rows,
        migrations: migrations.rows,
        customers: customers.rows,
        updateCheck,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
