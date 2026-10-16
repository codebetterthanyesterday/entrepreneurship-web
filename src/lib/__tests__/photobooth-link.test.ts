import { describe, expect, it } from "vitest";
import { claimLinkToken, photoboothLink } from "@/lib/photobooth-link";

const SECRET = "rahasia-tautan-klaim-0123456789abcdef";
const env = {
  PHOTOBOOTH_URL: "https://bunnye-photobooth.vercel.app",
  PHOTOBOOTH_CLAIM_LINK_SECRET: SECRET,
} as unknown as NodeJS.ProcessEnv;
const preorder = { orderNumber: "PO-0042", channel: "PREORDER" as const };

describe("claimLinkToken", () => {
  // The same vector is asserted in the photobooth repo
  // (tests/unit/claim-link.test.ts). If either side changes the scheme, one
  // of the two tests fails.
  it("matches the photobooth's token for the shared test vector", () => {
    expect(claimLinkToken("PO-0042", SECRET)).toBe("EPQFw-wP0i428E1ASccTTgzbFc3k1bQYEtS98MnC3F0");
  });
});

describe("photoboothLink", () => {
  it("links a preorder to the photobooth with its code filled in", () => {
    expect(photoboothLink(preorder, { withToken: false }, env)).toBe(
      "https://bunnye-photobooth.vercel.app/foto?kode=PO-0042",
    );
  });

  it("adds the token only when asked to", () => {
    const link = new URL(photoboothLink(preorder, { withToken: true }, env)!);

    expect(link.searchParams.get("kode")).toBe("PO-0042");
    expect(link.searchParams.get("t")).toBe(claimLinkToken("PO-0042", SECRET));
  });

  it("leaves the token out when no secret is configured", () => {
    const withoutSecret = { PHOTOBOOTH_URL: env.PHOTOBOOTH_URL } as unknown as NodeJS.ProcessEnv;

    expect(photoboothLink(preorder, { withToken: true }, withoutSecret)).not.toContain("t=");
  });

  it("gives an on-the-spot order no link", () => {
    expect(
      photoboothLink({ orderNumber: "OS-0001", channel: "ONSITE" }, { withToken: true }, env),
    ).toBeNull();
  });

  it("shows nothing when the photobooth address is not configured", () => {
    expect(photoboothLink(preorder, { withToken: false }, {} as NodeJS.ProcessEnv)).toBeNull();
  });
});
