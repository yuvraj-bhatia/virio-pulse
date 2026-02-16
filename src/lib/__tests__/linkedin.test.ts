import { describe, expect, it } from "vitest";

import { dedupeImportRows, normalizeLinkedInUrl } from "@/lib/linkedin";

describe("LinkedIn URL helpers", () => {
  it("strips query params and normalizes host/protocol", () => {
    const normalized = normalizeLinkedInUrl(
      "http://linkedin.com/feed/update/urn:li:activity:7345667788990011223/?utm_source=foo&tracking=bar"
    );

    expect(normalized).toBe("https://www.linkedin.com/feed/update/urn:li:activity:7345667788990011223");
  });

  it("dedupes exact same LinkedIn URL rows", () => {
    const { uniqueRows, skippedDuplicates } = dedupeImportRows([
      {
        postUrl: "https://www.linkedin.com/posts/example-one",
        hook: "First hook",
        postedAt: "2026-02-01T00:00:00.000Z"
      },
      {
        postUrl: "https://www.linkedin.com/posts/example-one?trk=feed",
        hook: "Second hook",
        postedAt: "2026-02-01T00:00:00.000Z"
      }
    ]);

    expect(uniqueRows).toHaveLength(1);
    expect(skippedDuplicates).toBe(1);
  });

  it("uses hook + postedAt fallback dedupe when postUrl is missing", () => {
    const { uniqueRows, skippedDuplicates } = dedupeImportRows([
      {
        postUrl: null,
        hook: "ROI angle: show your numbers",
        postedAt: "2026-02-12T00:00:00.000Z"
      },
      {
        postUrl: null,
        hook: "ROI angle: show your numbers",
        postedAt: "2026-02-12T00:00:00.000Z"
      }
    ]);

    expect(uniqueRows).toHaveLength(1);
    expect(skippedDuplicates).toBe(1);
  });
});
