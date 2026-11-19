import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/prisma";
import {
  MAX_PRODUCT_IMAGES,
  addProductImage,
  moveProductImage,
  removeProductImage,
} from "@/lib/services/product-image.service";
import { findProductImages } from "@/lib/queries/product-image.query";
import { deleteProduct } from "@/lib/services/product.service";
import { ValidationError } from "@/lib/errors";
import { closeDatabase, makeProduct, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

const JPEG = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n, 1, 2, 3]);

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const coverOf = async (id: string) => (await db.orm.public.Product.where({ id }).first())!.imageUrl ?? null;
const photosOf = async (id: string) => (await findProductImages([id])).get(id)!;

describe("product photos", () => {
  it("makes the first photo the cover, and keeps it there as more arrive", async () => {
    const product = await makeProduct();

    const first = await addProductImage(product.id, JPEG(1));
    await addProductImage(product.id, JPEG(2));

    expect(await coverOf(product.id)).toBe(first.url);
    expect((await photosOf(product.id)).map((photo) => photo.id)[0]).toBe(first.id);
  });

  it(`takes ${MAX_PRODUCT_IMAGES} photos and refuses one more`, async () => {
    const product = await makeProduct();
    for (let i = 0; i < MAX_PRODUCT_IMAGES; i++) await addProductImage(product.id, JPEG(i));

    await expect(addProductImage(product.id, JPEG(99))).rejects.toThrow(ValidationError);
    expect(await photosOf(product.id)).toHaveLength(MAX_PRODUCT_IMAGES);
  });

  it("refuses something that is not a picture, whatever it is called", async () => {
    const product = await makeProduct();

    await expect(addProductImage(product.id, new TextEncoder().encode("<script>"))).rejects.toThrow(
      /bukan gambar/,
    );
    expect(await coverOf(product.id)).toBeNull();
  });

  it("moves a photo to the front, and it becomes the cover", async () => {
    const product = await makeProduct();
    await addProductImage(product.id, JPEG(1));
    const second = await addProductImage(product.id, JPEG(2));

    await moveProductImage(product.id, second.id, -1);

    expect(await coverOf(product.id)).toBe(second.url);
    expect((await photosOf(product.id))[0]!.id).toBe(second.id);
  });

  it("removing the cover makes the next photo the cover; removing the last leaves the drawing", async () => {
    const product = await makeProduct();
    const first = await addProductImage(product.id, JPEG(1));
    const second = await addProductImage(product.id, JPEG(2));

    await removeProductImage(product.id, first.id);
    expect(await coverOf(product.id)).toBe(second.url);

    await removeProductImage(product.id, second.id);
    expect(await coverOf(product.id)).toBeNull();
    expect(await db.orm.public.StoredImage.where({ id: second.id }).first()).toBeNull();
  });

  it("keeps an address pasted in before uploads, until a photo is uploaded", async () => {
    const product = await makeProduct();
    await db.orm.public.Product.where({ id: product.id }).update({ imageUrl: "https://example.com/kopi.jpg" });
    const other = await makeProduct();
    await addProductImage(other.id, JPEG(1));

    expect(await coverOf(product.id)).toBe("https://example.com/kopi.jpg");

    const upload = await addProductImage(product.id, JPEG(2));
    expect(await coverOf(product.id)).toBe(upload.url);
  });

  it("will not touch a photo of another product", async () => {
    const mine = await makeProduct();
    const theirs = await makeProduct();
    const photo = await addProductImage(theirs.id, JPEG(1));

    await expect(removeProductImage(mine.id, photo.id)).rejects.toThrow(/nggak ketemu/);
    expect(await photosOf(theirs.id)).toHaveLength(1);
  });

  it("takes a product's photos with it when the product is deleted", async () => {
    const product = await makeProduct();
    const photo = await addProductImage(product.id, JPEG(1));

    await deleteProduct(product.id);

    expect(await db.orm.public.StoredImage.where({ id: photo.id }).first()).toBeNull();
  });
});
