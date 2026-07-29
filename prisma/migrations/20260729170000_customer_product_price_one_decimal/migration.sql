-- Preserve existing integer values while allowing customer-specific prices
-- to store one-decimal values such as 5.5 and 8.1.
ALTER TABLE "CustomerProductPrice"
  ALTER COLUMN "price" TYPE DOUBLE PRECISION
  USING "price"::DOUBLE PRECISION;
