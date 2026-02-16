import { AttributionConfidence, OpportunityStage, Prisma, type PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay, subDays } from "date-fns";

import { normalizeLinkedInUrl } from "@/lib/linkedin";

type DbClient = PrismaClient | Prisma.TransactionClient;

type ResolvedInbound = {
  inboundId: string;
  postId: string | null;
  confidence: AttributionConfidence;
};

type ResolvedOpportunity = {
  opportunityId: string;
  postId: string | null;
  confidence: AttributionConfidence;
};

type SupportingLinks = {
  inboundSignalIds: string[];
  opportunityIds: string[];
};

const CONFIDENCE_RANK: Record<AttributionConfidence, number> = {
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  UNATTRIBUTED: 1
};

function maxConfidence(values: AttributionConfidence[]): AttributionConfidence {
  if (values.length === 0) {
    return AttributionConfidence.UNATTRIBUTED;
  }

  return values.reduce((best, current) => {
    return CONFIDENCE_RANK[current] > CONFIDENCE_RANK[best] ? current : best;
  }, AttributionConfidence.UNATTRIBUTED);
}

function isLikelySameLink(entryPointUrl: string, postUrl: string): boolean {
  return entryPointUrl.includes(postUrl) || postUrl.includes(entryPointUrl);
}

function resolveInboundLinks(params: {
  inbounds: Array<{
    id: string;
    postId: string | null;
    entryPointUrl: string | null;
  }>;
  postIdSet: Set<string>;
  postByNormalizedUrl: Map<string, string>;
  postUrlPairs: Array<{ postId: string; postUrl: string }>;
}): Map<string, ResolvedInbound> {
  const resolved = new Map<string, ResolvedInbound>();

  for (const inbound of params.inbounds) {
    if (inbound.postId && params.postIdSet.has(inbound.postId)) {
      resolved.set(inbound.id, {
        inboundId: inbound.id,
        postId: inbound.postId,
        confidence: AttributionConfidence.HIGH
      });
      continue;
    }

    const rawEntryPoint = inbound.entryPointUrl?.trim() ?? "";
    if (!rawEntryPoint) {
      resolved.set(inbound.id, {
        inboundId: inbound.id,
        postId: null,
        confidence: AttributionConfidence.UNATTRIBUTED
      });
      continue;
    }

    const normalizedEntryPoint = normalizeLinkedInUrl(rawEntryPoint);
    if (normalizedEntryPoint) {
      const postId = params.postByNormalizedUrl.get(normalizedEntryPoint);
      if (postId) {
        resolved.set(inbound.id, {
          inboundId: inbound.id,
          postId,
          confidence: AttributionConfidence.MEDIUM
        });
        continue;
      }
    }

    const fallback = params.postUrlPairs.find(({ postUrl }) => isLikelySameLink(rawEntryPoint, postUrl));
    if (fallback) {
      resolved.set(inbound.id, {
        inboundId: inbound.id,
        postId: fallback.postId,
        confidence: AttributionConfidence.MEDIUM
      });
      continue;
    }

    resolved.set(inbound.id, {
      inboundId: inbound.id,
      postId: null,
      confidence: AttributionConfidence.UNATTRIBUTED
    });
  }

  return resolved;
}

function resolveOpportunityLinks(params: {
  opportunities: Array<{
    id: string;
    postId: string | null;
    inboundSignalId: string | null;
  }>;
  inboundMap: Map<string, ResolvedInbound>;
  postIdSet: Set<string>;
}): Map<string, ResolvedOpportunity> {
  const resolved = new Map<string, ResolvedOpportunity>();

  for (const opportunity of params.opportunities) {
    if (opportunity.inboundSignalId) {
      const inherited = params.inboundMap.get(opportunity.inboundSignalId);
      if (inherited?.postId) {
        resolved.set(opportunity.id, {
          opportunityId: opportunity.id,
          postId: inherited.postId,
          confidence: inherited.confidence
        });
        continue;
      }
    }

    if (opportunity.postId && params.postIdSet.has(opportunity.postId)) {
      resolved.set(opportunity.id, {
        opportunityId: opportunity.id,
        postId: opportunity.postId,
        confidence: AttributionConfidence.HIGH
      });
      continue;
    }

    resolved.set(opportunity.id, {
      opportunityId: opportunity.id,
      postId: null,
      confidence: AttributionConfidence.UNATTRIBUTED
    });
  }

  return resolved;
}

export async function recomputeAttributionRange(
  db: DbClient,
  clientId: string,
  rangeDays: number
): Promise<{ computedAt: Date; rows: number }> {
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(subDays(endDate, rangeDays - 1));
  const computedAt = new Date();

  const [posts, inbounds, opportunities] = await Promise.all([
    db.contentPost.findMany({
      where: { clientId },
      select: {
        id: true,
        postUrl: true
      }
    }),
    db.inboundSignal.findMany({
      where: {
        clientId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        postId: true,
        entryPointUrl: true
      }
    }),
    db.opportunity.findMany({
      where: {
        clientId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        amount: true,
        stage: true,
        postId: true,
        inboundSignalId: true
      }
    })
  ]);

  const postIdSet = new Set(posts.map((post) => post.id));
  const postByNormalizedUrl = new Map<string, string>();
  const postUrlPairs: Array<{ postId: string; postUrl: string }> = [];
  for (const post of posts) {
    const raw = post.postUrl?.trim();
    if (!raw) continue;
    const normalized = normalizeLinkedInUrl(raw);
    if (normalized) {
      postByNormalizedUrl.set(normalized, post.id);
      postUrlPairs.push({ postId: post.id, postUrl: normalized });
    } else {
      postUrlPairs.push({ postId: post.id, postUrl: raw });
    }
  }

  const inboundMap = resolveInboundLinks({
    inbounds,
    postIdSet,
    postByNormalizedUrl,
    postUrlPairs
  });

  const opportunityMap = resolveOpportunityLinks({
    opportunities,
    inboundMap,
    postIdSet
  });

  const aggregation = new Map<
    string,
    {
      meetingsInfluencedCount: number;
      pipelineCreatedAmount: number;
      revenueWonAmount: number;
      confidences: AttributionConfidence[];
      supportingLinks: SupportingLinks;
    }
  >();

  for (const post of posts) {
    aggregation.set(post.id, {
      meetingsInfluencedCount: 0,
      pipelineCreatedAmount: 0,
      revenueWonAmount: 0,
      confidences: [],
      supportingLinks: {
        inboundSignalIds: [],
        opportunityIds: []
      }
    });
  }

  for (const inbound of inboundMap.values()) {
    if (!inbound.postId) continue;
    const row = aggregation.get(inbound.postId);
    if (!row) continue;
    row.meetingsInfluencedCount += 1;
    row.confidences.push(inbound.confidence);
    row.supportingLinks.inboundSignalIds.push(inbound.inboundId);
  }

  for (const opportunity of opportunities) {
    const resolved = opportunityMap.get(opportunity.id);
    if (!resolved?.postId) continue;
    const row = aggregation.get(resolved.postId);
    if (!row) continue;
    row.pipelineCreatedAmount += opportunity.amount;
    if (opportunity.stage === OpportunityStage.closed_won) {
      row.revenueWonAmount += opportunity.amount;
    }
    row.confidences.push(resolved.confidence);
    row.supportingLinks.opportunityIds.push(opportunity.id);
  }

  if (posts.length === 0) {
    await db.attributionResult.deleteMany({
      where: {
        clientId,
        windowRangeDays: rangeDays
      }
    });

    return {
      computedAt,
      rows: 0
    };
  }

  for (const post of posts) {
    const row = aggregation.get(post.id);
    const supportingLinks = row?.supportingLinks ?? {
      inboundSignalIds: [],
      opportunityIds: []
    };

    const writeData = {
      computedAt,
      meetingsInfluencedCount: row?.meetingsInfluencedCount ?? 0,
      pipelineCreatedAmount: row?.pipelineCreatedAmount ?? 0,
      revenueWonAmount: row?.revenueWonAmount ?? 0,
      confidence: maxConfidence(row?.confidences ?? []),
      supportingLinks
    };

    await db.attributionResult.upsert({
      where: {
        clientId_postId_windowRangeDays: {
          clientId,
          postId: post.id,
          windowRangeDays: rangeDays
        }
      },
      create: {
        clientId,
        postId: post.id,
        windowRangeDays: rangeDays,
        ...writeData
      },
      update: writeData
    });
  }

  await db.attributionResult.deleteMany({
    where: {
      clientId,
      windowRangeDays: rangeDays,
      postId: {
        notIn: posts.map((post) => post.id)
      }
    }
  });

  return {
    computedAt,
    rows: posts.length
  };
}

export async function recomputeAttributionAllRanges(
  db: DbClient,
  clientId: string
): Promise<Array<{ rangeDays: number; computedAt: Date; rows: number }>> {
  const ranges = [7, 30, 90];
  const results: Array<{ rangeDays: number; computedAt: Date; rows: number }> = [];

  for (const rangeDays of ranges) {
    const result = await recomputeAttributionRange(db, clientId, rangeDays);
    results.push({
      rangeDays,
      computedAt: result.computedAt,
      rows: result.rows
    });
  }

  return results;
}

export function rangePresetToDays(range: "7" | "30" | "90"): number {
  return Number(range);
}
