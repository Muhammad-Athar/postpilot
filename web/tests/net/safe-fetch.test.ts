import { describe, it, expect } from "vitest";
import { isPrivateAddress, assertPublicHttpUrl, isOwnStorageUrl } from "@/lib/net/safe-fetch";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.9", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"])("%s is private", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700::1111"])("%s is public", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("assertPublicHttpUrl", () => {
  const resolve = async (host: string) => (host === "evil.test" ? ["10.0.0.5"] : host === "ok.test" ? ["93.184.216.34"] : []);
  it("accepts a public https host", async () => {
    await expect(assertPublicHttpUrl("https://ok.test/page", resolve)).resolves.toBeUndefined();
  });
  it("rejects non-http schemes, credentials, private IPs, hosts resolving privately and unresolvable hosts", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd", resolve)).rejects.toThrow();
    await expect(assertPublicHttpUrl("ftp://ok.test/x", resolve)).rejects.toThrow();
    await expect(assertPublicHttpUrl("https://user:pw@ok.test/x", resolve)).rejects.toThrow();
    await expect(assertPublicHttpUrl("http://127.0.0.1:5678/", resolve)).rejects.toThrow();
    await expect(assertPublicHttpUrl("http://[::1]/", resolve)).rejects.toThrow();
    await expect(assertPublicHttpUrl("https://evil.test/", resolve)).rejects.toThrow();
    await expect(assertPublicHttpUrl("https://nowhere.test/", resolve)).rejects.toThrow();
    await expect(assertPublicHttpUrl("https://localhost/", resolve)).rejects.toThrow();
  });
});

describe("isOwnStorageUrl", () => {
  it("accepts only public object URLs in our media bucket", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    expect(isOwnStorageUrl("https://abc.supabase.co/storage/v1/object/public/media/ws/refs/a.png")).toBe(true);
    expect(isOwnStorageUrl("https://abc.supabase.co/storage/v1/object/public/other/a.png")).toBe(false);
    expect(isOwnStorageUrl("https://evil.example/storage/v1/object/public/media/a.png")).toBe(false);
    expect(isOwnStorageUrl("not a url")).toBe(false);
  });
});
