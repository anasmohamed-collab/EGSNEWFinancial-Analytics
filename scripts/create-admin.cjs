/**
 * Production admin bootstrap.
 *
 * Creates the ADMIN user from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD if it does
 * not already exist. Unlike prisma/seed.ts this:
 *   - does NOT delete anything and does NOT insert demo data,
 *   - is idempotent (leaves an existing admin — and its password — untouched),
 *   - runs on plain Node using production dependencies only (no tsx), so it
 *     works inside the production container.
 *
 * It never throws in a way that blocks app startup (exits 0 on error).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

(async () => {
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "";

  if (!email || !password) {
    console.log(
      "[create-admin] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin creation.",
    );
    return;
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`[create-admin] Admin already exists (${email}) — leaving unchanged.`);
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, name: "Eagles Admin", passwordHash, role: "ADMIN" },
    });
    console.log(`[create-admin] Created admin user: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((err) => {
  // Best-effort: never block application startup on admin bootstrap.
  console.error("[create-admin] Failed (non-fatal):", err && err.message ? err.message : err);
  process.exit(0);
});
