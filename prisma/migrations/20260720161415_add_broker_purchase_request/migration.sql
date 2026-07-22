-- CreateTable
CREATE TABLE "BrokerPurchaseRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "productSkuId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT '매입대기',
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrokerPurchaseRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BrokerPurchaseRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BrokerPurchaseRequest_productSkuId_fkey" FOREIGN KEY ("productSkuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BrokerPurchaseRequest_supplierId_status_idx" ON "BrokerPurchaseRequest"("supplierId", "status");

-- CreateIndex
CREATE INDEX "BrokerPurchaseRequest_orderId_idx" ON "BrokerPurchaseRequest"("orderId");
