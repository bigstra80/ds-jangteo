import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { normalizeProductName } from "../lib/product-name";

type DuplicateCandidate = {
  key: string;
  products: Array<{
    id: number;
    code: string;
    name: string;
    sourceProductName: string | null;
    supplierId: number | null;
  }>;
};

function duplicateGroups<T>(
  products: T[],
  getKey: (product: T) => string
): DuplicateCandidate[] {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const key = getKey(product);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), product]);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({ key, products: values as DuplicateCandidate["products"] }));
}

async function main() {
  const applyChanges = process.argv.includes("--apply");
  const products = await prisma.product.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      sourceProductName: true,
      supplierId: true,
    },
    orderBy: { id: "asc" },
  });

  const normalized = products.map((product) => ({
    ...product,
    normalizedName: normalizeProductName(product.name),
    normalizedSourceProductName:
      product.sourceProductName == null
        ? null
        : normalizeProductName(product.sourceProductName),
  }));
  const changed = normalized.filter(
    (product) =>
      product.name !== product.normalizedName ||
      product.sourceProductName !== product.normalizedSourceProductName
  );
  const duplicateReport = {
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    changedProducts: changed.length,
    sameCode: duplicateGroups(products, (product) => product.code.trim().toLowerCase()),
    sameNormalizedName: duplicateGroups(normalized, (product) =>
      normalizeProductName(product.sourceProductName || product.name).toLocaleLowerCase("ko-KR")
    ),
    sameCodeAndSupplier: duplicateGroups(products, (product) =>
      `${product.code.trim().toLowerCase()}::${product.supplierId ?? "none"}`
    ),
  };

  const outputDir = path.join(process.cwd(), "backups", "product-name-normalization");
  await mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(outputDir, `duplicate-report-${stamp}.json`);
  await writeFile(reportPath, JSON.stringify(duplicateReport, null, 2), "utf8");

  if (!applyChanges) {
    console.log(JSON.stringify({ mode: "dry-run", changed: changed.length, reportPath }, null, 2));
    return;
  }

  const backupPath = path.join(outputDir, `product-names-backup-${stamp}.json`);
  await writeFile(backupPath, JSON.stringify(products, null, 2), "utf8");
  await prisma.$transaction(
    changed.map((product) =>
      prisma.product.update({
        where: { id: product.id },
        data: {
          name: product.normalizedName,
          sourceProductName: product.normalizedSourceProductName,
        },
      })
    )
  );
  console.log(
    JSON.stringify(
      { mode: "applied", updated: changed.length, backupPath, reportPath },
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
  });

