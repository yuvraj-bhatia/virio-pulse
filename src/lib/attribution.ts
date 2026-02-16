import { AttributionConfidence, type ContentPost, type InboundSignal, type Meeting, type Opportunity } from "@prisma/client";

export type AttributionOptions = {
  attributionWindowDays: number;
  useSoftAttribution: boolean;
};

export type AttributionPost = Pick<ContentPost, "id" | "executiveId" | "postedAt" | "hook" | "theme">;

export type AttributionInbound = Pick<
  InboundSignal,
  "id" | "postId" | "executiveId" | "createdAt" | "source" | "clientId"
>;

export type ResolvedInboundAttribution = {
  inboundId: string;
  clientId: string;
  attributedPostId: string | null;
  confidence: AttributionConfidence;
  isDirect: boolean;
  source: string;
  createdAt: Date;
};

export type ResolvedMeetingAttribution = {
  meetingId: string;
  inboundId: string | null;
  attributedPostId: string | null;
  confidence: AttributionConfidence;
  isDirect: boolean;
};

export type ResolvedOpportunityAttribution = {
  opportunityId: string;
  meetingId: string | null;
  attributedPostId: string | null;
  confidence: AttributionConfidence;
  isDirect: boolean;
};

function isWithinWindow(postedAt: Date, inboundAt: Date, windowDays: number): boolean {
  if (postedAt.getTime() > inboundAt.getTime()) {
    return false;
  }

  const diffMs = inboundAt.getTime() - postedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= windowDays;
}

export function resolveInboundAttributions(
  inbounds: AttributionInbound[],
  posts: AttributionPost[],
  options: AttributionOptions
): Map<string, ResolvedInboundAttribution> {
  const byExecutive = new Map<string, AttributionPost[]>();

  for (const post of posts) {
    const bucket = byExecutive.get(post.executiveId) ?? [];
    bucket.push(post);
    byExecutive.set(post.executiveId, bucket);
  }

  for (const [, bucket] of byExecutive) {
    bucket.sort((a, b) => {
      const time = b.postedAt.getTime() - a.postedAt.getTime();
      if (time !== 0) return time;
      return b.id.localeCompare(a.id);
    });
  }

  const resolved = new Map<string, ResolvedInboundAttribution>();

  for (const inbound of inbounds) {
    if (inbound.postId) {
      resolved.set(inbound.id, {
        inboundId: inbound.id,
        clientId: inbound.clientId,
        attributedPostId: inbound.postId,
        confidence: AttributionConfidence.HIGH,
        isDirect: true,
        source: inbound.source,
        createdAt: inbound.createdAt
      });
      continue;
    }

    if (!options.useSoftAttribution) {
      resolved.set(inbound.id, {
        inboundId: inbound.id,
        clientId: inbound.clientId,
        attributedPostId: null,
        confidence: AttributionConfidence.LOW,
        isDirect: false,
        source: inbound.source,
        createdAt: inbound.createdAt
      });
      continue;
    }

    if (!inbound.executiveId) {
      resolved.set(inbound.id, {
        inboundId: inbound.id,
        clientId: inbound.clientId,
        attributedPostId: null,
        confidence: AttributionConfidence.LOW,
        isDirect: false,
        source: inbound.source,
        createdAt: inbound.createdAt
      });
      continue;
    }

    const postsForExecutive = byExecutive.get(inbound.executiveId) ?? [];
    const match = postsForExecutive.find((post) =>
      isWithinWindow(post.postedAt, inbound.createdAt, options.attributionWindowDays)
    );

    if (!match) {
      resolved.set(inbound.id, {
        inboundId: inbound.id,
        clientId: inbound.clientId,
        attributedPostId: null,
        confidence: AttributionConfidence.LOW,
        isDirect: false,
        source: inbound.source,
        createdAt: inbound.createdAt
      });
      continue;
    }

    resolved.set(inbound.id, {
      inboundId: inbound.id,
      clientId: inbound.clientId,
      attributedPostId: match.id,
      confidence: AttributionConfidence.MEDIUM,
      isDirect: false,
      source: inbound.source,
      createdAt: inbound.createdAt
    });
  }

  return resolved;
}

export function resolveMeetingAttributions(
  meetings: Pick<Meeting, "id" | "inboundId">[],
  inboundAttributions: Map<string, ResolvedInboundAttribution>
): Map<string, ResolvedMeetingAttribution> {
  const resolved = new Map<string, ResolvedMeetingAttribution>();

  for (const meeting of meetings) {
    if (!meeting.inboundId) {
      resolved.set(meeting.id, {
        meetingId: meeting.id,
        inboundId: null,
        attributedPostId: null,
        confidence: AttributionConfidence.LOW,
        isDirect: false
      });
      continue;
    }

    const inbound = inboundAttributions.get(meeting.inboundId);
    if (!inbound) {
      resolved.set(meeting.id, {
        meetingId: meeting.id,
        inboundId: meeting.inboundId,
        attributedPostId: null,
        confidence: AttributionConfidence.LOW,
        isDirect: false
      });
      continue;
    }

    resolved.set(meeting.id, {
      meetingId: meeting.id,
      inboundId: meeting.inboundId,
      attributedPostId: inbound.attributedPostId,
      confidence: inbound.confidence,
      isDirect: inbound.isDirect
    });
  }

  return resolved;
}

export function resolveOpportunityAttributions(
  opportunities: Pick<Opportunity, "id" | "meetingId">[],
  meetingAttributions: Map<string, ResolvedMeetingAttribution>
): Map<string, ResolvedOpportunityAttribution> {
  const resolved = new Map<string, ResolvedOpportunityAttribution>();

  for (const opportunity of opportunities) {
    if (!opportunity.meetingId) {
      resolved.set(opportunity.id, {
        opportunityId: opportunity.id,
        meetingId: null,
        attributedPostId: null,
        confidence: AttributionConfidence.LOW,
        isDirect: false
      });
      continue;
    }

    const meeting = meetingAttributions.get(opportunity.meetingId);
    if (!meeting) {
      resolved.set(opportunity.id, {
        opportunityId: opportunity.id,
        meetingId: opportunity.meetingId,
        attributedPostId: null,
        confidence: AttributionConfidence.LOW,
        isDirect: false
      });
      continue;
    }

    resolved.set(opportunity.id, {
      opportunityId: opportunity.id,
      meetingId: opportunity.meetingId,
      attributedPostId: meeting.attributedPostId,
      confidence: meeting.confidence,
      isDirect: meeting.isDirect
    });
  }

  return resolved;
}

export function mergeConfidence(confidences: AttributionConfidence[]): AttributionConfidence {
  if (confidences.includes(AttributionConfidence.HIGH)) return AttributionConfidence.HIGH;
  if (confidences.includes(AttributionConfidence.MEDIUM)) return AttributionConfidence.MEDIUM;
  return AttributionConfidence.LOW;
}
