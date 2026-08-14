import { prisma } from "@/lib/prisma";
import {
  ProductIdentityResolutionError,
  resolveProductIdentity,
} from "@/lib/product-identity";

export { ProductIdentityResolutionError as LedgerProductResolutionError };

export async function resolveLedgerProduct(
  body: Record<string, unknown>
) {
  return resolveProductIdentity(body, prisma.product);
}
