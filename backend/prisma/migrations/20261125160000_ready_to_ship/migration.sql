ALTER TABLE "Product" ADD COLUMN "readyToShip" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Product_readyToShip_idx" ON "Product"("readyToShip");

CREATE TABLE "ProductStockSize" (
    "productId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,

    CONSTRAINT "ProductStockSize_pkey" PRIMARY KEY ("productId","sizeId")
);

ALTER TABLE "ProductStockSize" ADD CONSTRAINT "ProductStockSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductStockSize" ADD CONSTRAINT "ProductStockSize_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
