import { revalidatePath } from "next/cache";

/**
 * Every page that shows a product's cover photo: the catalogue (the home
 * page), the cart, the checkout, the till, and the admin's menu and dashboard.
 * Kept out of the actions file, where every export would be a server action
 * anyone could call.
 */
export function revalidateProductPhotos(): void {
  for (const path of ["/", "/keranjang", "/checkout", "/kasir", "/admin", "/admin/menu"]) {
    revalidatePath(path);
  }
}
