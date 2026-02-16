import { AttributionConfidence } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  resolveInboundAttributions,
  resolveMeetingAttributions,
  resolveOpportunityAttributions,
  type AttributionInbound,
  type AttributionPost
} from "@/lib/attribution";

const baseDate = new Date("2026-02-10T00:00:00.000Z");

const posts: AttributionPost[] = [
  {
    id: "post-old",
    executiveId: "exec-1",
    postedAt: new Date("2026-01-31T12:00:00.000Z"),
    hook: "Old hook",
    theme: "pricing"
  },
  {
    id: "post-new",
    executiveId: "exec-1",
    postedAt: new Date("2026-02-08T12:00:00.000Z"),
    hook: "New hook",
    theme: "ROI"
  },
  {
    id: "post-other-exec",
    executiveId: "exec-2",
    postedAt: new Date("2026-02-07T12:00:00.000Z"),
    hook: "Other exec hook",
    theme: "security"
  }
];

function inbound(overrides: Partial<AttributionInbound>): AttributionInbound {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    clientId: "client-1",
    createdAt: overrides.createdAt ?? baseDate,
    executiveId: overrides.executiveId ?? null,
    postId: overrides.postId ?? null,
    source: overrides.source ?? "linkedin_dm"
  };
}

describe("resolveInboundAttributions", () => {
  it("marks direct postId attribution as HIGH", () => {
    const inbounds = [inbound({ id: "in-1", postId: "post-old" })];
    const result = resolveInboundAttributions(inbounds, posts, {
      attributionWindowDays: 7,
      useSoftAttribution: true
    });

    expect(result.get("in-1")?.attributedPostId).toBe("post-old");
    expect(result.get("in-1")?.confidence).toBe(AttributionConfidence.HIGH);
  });

  it("uses soft attribution when executive matches within window", () => {
    const inbounds = [
      inbound({
        id: "in-2",
        executiveId: "exec-1",
        createdAt: new Date("2026-02-10T00:00:00.000Z")
      })
    ];

    const result = resolveInboundAttributions(inbounds, posts, {
      attributionWindowDays: 7,
      useSoftAttribution: true
    });

    expect(result.get("in-2")?.attributedPostId).toBe("post-new");
    expect(result.get("in-2")?.confidence).toBe(AttributionConfidence.MEDIUM);
  });

  it("does not soft-attribute outside attribution window", () => {
    const inbounds = [
      inbound({
        id: "in-3",
        executiveId: "exec-1",
        createdAt: new Date("2026-02-20T00:00:00.000Z")
      })
    ];

    const result = resolveInboundAttributions(inbounds, posts, {
      attributionWindowDays: 7,
      useSoftAttribution: true
    });

    expect(result.get("in-3")?.attributedPostId).toBeNull();
    expect(result.get("in-3")?.confidence).toBe(AttributionConfidence.LOW);
  });

  it("disables soft attribution when setting is off", () => {
    const inbounds = [
      inbound({
        id: "in-4",
        executiveId: "exec-1",
        createdAt: new Date("2026-02-10T00:00:00.000Z")
      })
    ];

    const result = resolveInboundAttributions(inbounds, posts, {
      attributionWindowDays: 14,
      useSoftAttribution: false
    });

    expect(result.get("in-4")?.attributedPostId).toBeNull();
    expect(result.get("in-4")?.confidence).toBe(AttributionConfidence.LOW);
  });

  it("keeps inbound without postId and executiveId unattributed (LOW)", () => {
    const inbounds = [inbound({ id: "in-5", postId: null, executiveId: null })];

    const result = resolveInboundAttributions(inbounds, posts, {
      attributionWindowDays: 7,
      useSoftAttribution: true
    });

    expect(result.get("in-5")?.attributedPostId).toBeNull();
    expect(result.get("in-5")?.confidence).toBe(AttributionConfidence.LOW);
  });

  it("uses deterministic tie-breaker (latest id when timestamp equal)", () => {
    const tiePosts: AttributionPost[] = [
      {
        id: "tie-a",
        executiveId: "exec-x",
        postedAt: new Date("2026-02-05T00:00:00.000Z"),
        hook: "A",
        theme: "pricing"
      },
      {
        id: "tie-z",
        executiveId: "exec-x",
        postedAt: new Date("2026-02-05T00:00:00.000Z"),
        hook: "Z",
        theme: "pricing"
      }
    ];

    const inbounds = [inbound({ id: "in-6", executiveId: "exec-x", createdAt: new Date("2026-02-06T00:00:00.000Z") })];

    const result = resolveInboundAttributions(inbounds, tiePosts, {
      attributionWindowDays: 7,
      useSoftAttribution: true
    });

    expect(result.get("in-6")?.attributedPostId).toBe("tie-z");
  });
});

describe("inheritance and aggregation", () => {
  it("meeting inherits inbound attribution", () => {
    const inboundMap = resolveInboundAttributions(
      [inbound({ id: "in-7", postId: "post-old" })],
      posts,
      { attributionWindowDays: 7, useSoftAttribution: true }
    );

    const meetings = [{ id: "m-1", inboundId: "in-7" }];
    const result = resolveMeetingAttributions(meetings, inboundMap);

    expect(result.get("m-1")?.attributedPostId).toBe("post-old");
    expect(result.get("m-1")?.confidence).toBe(AttributionConfidence.HIGH);
  });

  it("opportunity inherits meeting attribution", () => {
    const inboundMap = resolveInboundAttributions(
      [inbound({ id: "in-8", executiveId: "exec-1", createdAt: new Date("2026-02-09T00:00:00.000Z") })],
      posts,
      { attributionWindowDays: 7, useSoftAttribution: true }
    );

    const meetings = [{ id: "m-2", inboundId: "in-8" }];
    const meetingMap = resolveMeetingAttributions(meetings, inboundMap);
    const opportunities = [{ id: "o-1", meetingId: "m-2" }];
    const result = resolveOpportunityAttributions(opportunities, meetingMap);

    expect(result.get("o-1")?.attributedPostId).toBe("post-new");
    expect(result.get("o-1")?.confidence).toBe(AttributionConfidence.MEDIUM);
  });

  it("supports correct aggregation by post", () => {
    const inboundMap = resolveInboundAttributions(
      [
        inbound({ id: "in-9", postId: "post-old" }),
        inbound({ id: "in-10", executiveId: "exec-1", createdAt: new Date("2026-02-09T00:00:00.000Z") })
      ],
      posts,
      { attributionWindowDays: 7, useSoftAttribution: true }
    );

    const meetingMap = resolveMeetingAttributions(
      [
        { id: "m-3", inboundId: "in-9" },
        { id: "m-4", inboundId: "in-10" }
      ],
      inboundMap
    );

    const opportunityMap = resolveOpportunityAttributions(
      [
        { id: "o-2", meetingId: "m-3" },
        { id: "o-3", meetingId: "m-4" }
      ],
      meetingMap
    );

    const counts = Array.from(opportunityMap.values()).reduce<Record<string, number>>((acc, current) => {
      const key = current.attributedPostId ?? "none";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts["post-old"]).toBe(1);
    expect(counts["post-new"]).toBe(1);
  });
});
