-- Store the exact selected product on ledger rows. Both columns are nullable so
-- existing ledger data remains untouched; ambiguous legacy names are not guessed.
ALTER TABLE "WholesaleLedger"
  ADD COLUMN "productId" INTEGER,
  ADD COLUMN "productCode" TEXT;

CREATE INDEX "WholesaleLedger_productId_idx" ON "WholesaleLedger"("productId");
CREATE INDEX "WholesaleLedger_productCode_idx" ON "WholesaleLedger"("productCode");

ALTER TABLE "WholesaleLedger"
  ADD CONSTRAINT "WholesaleLedger_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
