import {
  AttributionConfidence,
  MeetingOutcome,
  OpportunityStage,
  PostStatus,
  Prisma,
  type AppSetting,
  type Client,
  type ContentPost,
  type Executive,
  type InboundSignal,
  type Meeting,
  type Opportunity
} from "@prisma/client";
import { differenceInCalendarDays, endOfWeek, format, startOfWeek, subDays } from "date-fns";

import { recomputeAttributionRange } from "@/lib/attribution-results";
import { prisma } from "@/lib/db";
import {
  resolveInboundAttributions,
  resolveMeetingAttributions,
  resolveOpportunityAttributions,
  type ResolvedInboundAttribution,
  type ResolvedMeetingAttribution,
  type ResolvedOpportunityAttribution
} from "@/lib/attribution";
import type {
  ContentListItem,
  FunnelMetrics,
  HookPerformance,
  KpiSummary,
  MeetingDetail,
  OpportunityListItem,
  PostAttributionRow,
  StageDistributionItem,
  ThemePerformance,
  WeeklySeriesPoint
} from "@/types";

type PostWithExecutive = ContentPost & { executive: Executive };

type AnalyticsSettings = Pick<AppSetting, "attributionWindowDays" | "useSoftAttribution">;

export type ContentFilters = {
  executiveId?: string;
  theme?: string;
  format?: ContentPost["format"];
  status?: PostStatus;
  search?: string;
};

export type AnalyticsWindow = {
  clientId: string;
  startDate: Date;
  endDate: Date;
};

export type OverviewResult = {
  kpis: KpiSummary;
  weeklySeries: WeeklySeriesPoint[];
  topPostsByRevenue: Array<{
    postId: string;
    theme: string;
    format: ContentPost["format"];
    postedAt: Date | null;
    hook: string;
    meetings: number;
    revenue: number;
  }>;
  whatChanged: string;
  themePerformance: ThemePerformance[];
  topHooks: HookPerformance[];
};

export type PipelineResult = {
  funnel: FunnelMetrics;
  opportunities: OpportunityListItem[];
  stageDistribution: StageDistributionItem[];
};

export type Dataset = {
  settings: AnalyticsSettings;
  postsInRange: PostWithExecutive[];
  attributionPosts: PostWithExecutive[];
  inboundsInRange: InboundSignal[];
  meetingsInRange: Meeting[];
  opportunitiesInRange: Opportunity[];
  inboundAttribution: Map<string, ResolvedInboundAttribution>;
  meetingAttribution: Map<string, ResolvedMeetingAttribution>;
  opportunityAttribution: Map<string, ResolvedOpportunityAttribution>;
};

export async function getClients(): Promise<Client[]> {
  return prisma.client.findMany({
    orderBy: { name: "asc" }
  });
}

export async function getClientSettings(clientId: string): Promise<AnalyticsSettings> {
  const setting = await prisma.appSetting.findUnique({ where: { clientId } });
  return (
    setting ?? {
      attributionWindowDays: 7,
      useSoftAttribution: true
    }
  );
}

export async function loadDataset(window: AnalyticsWindow): Promise<Dataset> {
  const settings = await getClientSettings(window.clientId);
  const attributionStart = subDays(window.startDate, settings.attributionWindowDays);

  const [postsInRange, attributionPosts, inboundsInRange, meetingsInRange, opportunitiesInRange] = await Promise.all([
    prisma.contentPost.findMany({
      where: {
        clientId: window.clientId,
        postedAt: {
          gte: window.startDate,
          lte: window.endDate
        }
      },
      include: { executive: true },
      orderBy: { postedAt: "desc" }
    }),
    prisma.contentPost.findMany({
      where: {
        clientId: window.clientId,
        postedAt: {
          gte: attributionStart,
          lte: window.endDate
        }
      },
      include: { executive: true },
      orderBy: { postedAt: "desc" }
    }),
    prisma.inboundSignal.findMany({
      where: {
        clientId: window.clientId,
        createdAt: {
          gte: window.startDate,
          lte: window.endDate
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.meeting.findMany({
      where: {
        clientId: window.clientId,
        scheduledAt: {
          gte: window.startDate,
          lte: window.endDate
        }
      },
      orderBy: { scheduledAt: "desc" }
    }),
    prisma.opportunity.findMany({
      where: {
        clientId: window.clientId,
        createdAt: {
          gte: window.startDate,
          lte: window.endDate
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const attributionEligiblePosts = attributionPosts.filter(
    (post): post is PostWithExecutive & { postedAt: Date } => post.postedAt !== null
  );

  const inboundAttribution = resolveInboundAttributions(inboundsInRange, attributionEligiblePosts, settings);
  const meetingAttribution = resolveMeetingAttributions(meetingsInRange, inboundAttribution);
  const opportunityAttribution = resolveOpportunityAttributions(
    opportunitiesInRange,
    meetingAttribution,
    inboundAttribution
  );

  return {
    settings,
    postsInRange,
    attributionPosts,
    inboundsInRange,
    meetingsInRange,
    opportunitiesInRange,
    inboundAttribution,
    meetingAttribution,
    opportunityAttribution
  };
}

function getRangeDays(window: AnalyticsWindow): 7 | 30 | 90 {
  const rangeDays = differenceInCalendarDays(window.endDate, window.startDate) + 1;
  if (rangeDays <= 7) return 7;
  if (rangeDays <= 30) return 30;
  return 90;
}

async function readAttributionResults(window: AnalyticsWindow): Promise<
  Array<{
    postId: string;
    meetingsInfluencedCount: number;
    pipelineCreatedAmount: number;
    revenueWonAmount: number;
    confidence: AttributionConfidence;
    post: {
      id: string;
      theme: string;
      format: ContentPost["format"];
      postedAt: Date | null;
      hook: string | null;
      impressions: number;
    };
  }>
> {
  const rangeDays = getRangeDays(window);
  let rows = await prisma.attributionResult.findMany({
    where: {
      clientId: window.clientId,
      windowRangeDays: rangeDays
    },
    include: {
      post: {
        select: {
          id: true,
          theme: true,
          format: true,
          postedAt: true,
          hook: true,
          impressions: true
        }
      }
    }
  });

  if (rows.length === 0) {
    await recomputeAttributionRange(prisma, window.clientId, rangeDays);
    rows = await prisma.attributionResult.findMany({
      where: {
        clientId: window.clientId,
        windowRangeDays: rangeDays
      },
      include: {
        post: {
          select: {
            id: true,
            theme: true,
            format: true,
            postedAt: true,
            hook: true,
            impressions: true
          }
        }
      }
    });
  }

  return rows;
}

export async function getOverviewData(window: AnalyticsWindow): Promise<OverviewResult> {
  const [dataset, attributionRows] = await Promise.all([loadDataset(window), readAttributionResults(window)]);

  const meetingsInfluenced = attributionRows.reduce((sum, row) => sum + row.meetingsInfluencedCount, 0);

  const wins = dataset.opportunitiesInRange.filter((opp) => opp.stage === OpportunityStage.closed_won);
  const attributedWins = wins.filter((opp) => Boolean(dataset.opportunityAttribution.get(opp.id)?.attributedPostId));

  const pipelineCreated = dataset.opportunitiesInRange.reduce((sum, opportunity) => sum + opportunity.amount, 0);
  const revenueWon = attributionRows.reduce((sum, row) => sum + row.revenueWonAmount, 0);

  const postsCount = Math.max(attributionRows.length, 1);
  const contentToMeetingRate = meetingsInfluenced / postsCount;
  const meetingToWinRate = meetingsInfluenced === 0 ? 0 : attributedWins.length / meetingsInfluenced;

  const kpis: KpiSummary = {
    meetingsInfluenced,
    pipelineCreated,
    revenueWon,
    contentToMeetingRate,
    meetingToWinRate,
    revenuePerPost: revenueWon / postsCount,
    meetingsPerPost: meetingsInfluenced / postsCount
  };

  const weeklyMap = new Map<string, WeeklySeriesPoint>();
  const registerWeek = (date: Date): string => format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");

  for (const meeting of dataset.meetingsInRange) {
    const attribution = dataset.meetingAttribution.get(meeting.id);
    if (!attribution?.attributedPostId) continue;
    const weekStart = registerWeek(meeting.scheduledAt);
    const entry = weeklyMap.get(weekStart) ?? { weekStart, meetingsInfluenced: 0, revenueWon: 0 };
    entry.meetingsInfluenced += 1;
    weeklyMap.set(weekStart, entry);
  }

  for (const win of attributedWins) {
    const weekSource = win.closedAt ?? win.createdAt;
    const weekStart = registerWeek(weekSource);
    const entry = weeklyMap.get(weekStart) ?? { weekStart, meetingsInfluenced: 0, revenueWon: 0 };
    entry.revenueWon += win.amount;
    weeklyMap.set(weekStart, entry);
  }

  const weeklySeries = Array.from(weeklyMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const meetingsByPost = new Map<string, number>();
  for (const meeting of dataset.meetingsInRange) {
    const attributedPostId = dataset.meetingAttribution.get(meeting.id)?.attributedPostId;
    if (!attributedPostId) continue;
    meetingsByPost.set(attributedPostId, (meetingsByPost.get(attributedPostId) ?? 0) + 1);
  }

  const revenueByPost = new Map<string, number>();
  for (const opportunity of attributedWins) {
    const attributedPostId = dataset.opportunityAttribution.get(opportunity.id)?.attributedPostId;
    if (!attributedPostId) continue;
    revenueByPost.set(attributedPostId, (revenueByPost.get(attributedPostId) ?? 0) + opportunity.amount);
  }

  const byPost = attributionRows.map((row) => ({
    postId: row.postId,
    theme: row.post.theme,
    format: row.post.format,
    postedAt: row.post.postedAt,
    hook: row.post.hook ?? "(missing hook)",
    meetings: row.meetingsInfluencedCount,
    revenue: row.revenueWonAmount
  }));

  const topPostsByRevenue = byPost.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const hasAnyWorkspaceData =
    dataset.postsInRange.length > 0 ||
    dataset.inboundsInRange.length > 0 ||
    dataset.meetingsInRange.length > 0 ||
    dataset.opportunitiesInRange.length > 0;

  let whatChanged = "No data yet. Import posts and add inbound signals to start attribution.";

  if (hasAnyWorkspaceData) {
    const previousRangeStart = subDays(window.startDate, differenceInCalendarDays(window.endDate, window.startDate) + 1);
    const previousRangeEnd = subDays(window.startDate, 1);

    const previousOpps = await prisma.opportunity.findMany({
      where: {
        clientId: window.clientId,
        createdAt: {
          gte: previousRangeStart,
          lte: previousRangeEnd
        },
        stage: OpportunityStage.closed_won
      }
    });

    const previousRevenue = previousOpps.reduce((sum, opp) => sum + opp.amount, 0);
    const delta =
      previousRevenue === 0 ? (revenueWon === 0 ? 0 : 1) : (revenueWon - previousRevenue) / previousRevenue;
    const direction = delta >= 0 ? "up" : "down";
    const changePercent = `${Math.abs(delta * 100).toFixed(1)}%`;

    whatChanged = `Revenue influence is ${direction} ${changePercent} versus the prior period. ${
      revenueWon > pipelineCreated * 0.25
        ? "Closed-won velocity improved; prioritize pricing and ROI narratives."
        : "Pipeline is forming but win conversion is lagging; tighten qualification hooks."
    }`;
  }

  const themeMap = new Map<string, ThemePerformance>();
  for (const row of attributionRows) {
    if (!themeMap.has(row.post.theme)) {
      themeMap.set(row.post.theme, {
        theme: row.post.theme,
        meetings: 0,
        revenue: 0,
        posts: 0
      });
    }
    const entry = themeMap.get(row.post.theme);
    if (!entry) continue;
    entry.posts += 1;
    entry.meetings += row.meetingsInfluencedCount;
    entry.revenue += row.revenueWonAmount;
  }

  const themePerformance = Array.from(themeMap.values()).sort((a, b) => b.revenue - a.revenue);

  const hookPerformance: HookPerformance[] = attributionRows
    .map((row) => ({
      hook: row.post.hook ?? "(missing hook)",
      meetings: row.meetingsInfluencedCount
    }))
    .sort((a, b) => b.meetings - a.meetings)
    .slice(0, 5);

  return {
    kpis,
    weeklySeries,
    topPostsByRevenue,
    whatChanged,
    themePerformance,
    topHooks: hookPerformance
  };
}

export async function getContentData(window: AnalyticsWindow, filters: ContentFilters): Promise<ContentListItem[]> {
  const where: Prisma.ContentPostWhereInput = {
    clientId: window.clientId,
    OR: [
      {
        postedAt: {
          gte: window.startDate,
          lte: window.endDate
        }
      },
      {
        postedAt: null
      }
    ]
  };

  if (filters.executiveId) where.executiveId = filters.executiveId;
  if (filters.theme) where.theme = filters.theme;
  if (filters.format) where.format = filters.format;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { hook: { contains: filters.search } },
      { body: { contains: filters.search } }
    ];
  }

  const posts = await prisma.contentPost.findMany({
    where,
    include: { executive: true },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }]
  });

  return posts.map((post) => ({
    id: post.id,
    clientId: post.clientId,
    executiveId: post.executiveId,
    postUrl: post.postUrl,
    executiveName: post.executive.name,
    postedAt: post.postedAt,
    format: post.format,
    theme: post.theme,
    hook: post.hook,
    body: post.body,
    impressions: post.impressions,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    ctaType: post.ctaType,
    status: post.status
  }));
}

export async function getPostDetail(postId: string): Promise<{
  post: PostWithExecutive | null;
  inbounds: InboundSignal[];
  meetings: MeetingDetail[];
  opportunities: Opportunity[];
}> {
  const post = await prisma.contentPost.findUnique({
    where: { id: postId },
    include: { executive: true }
  });

  if (!post) {
    return { post: null, inbounds: [], meetings: [], opportunities: [] };
  }

  const directInbounds = await prisma.inboundSignal.findMany({
    where: {
      OR: [
        { postId: post.id },
        ...(post.postUrl
          ? [
              {
                entryPointUrl: {
                  contains: post.postUrl
                }
              }
            ]
          : [])
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  const meetings = await prisma.meeting.findMany({
    where: {
      inboundId: { in: directInbounds.map((inbound) => inbound.id) }
    },
    orderBy: { scheduledAt: "desc" }
  });

  const opportunities = await prisma.opportunity.findMany({
    where: {
      OR: [
        {
          meetingId: {
            in: meetings.map((meeting) => meeting.id)
          }
        },
        { postId: post.id },
        {
          inboundSignalId: {
            in: directInbounds.map((inbound) => inbound.id)
          }
        }
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  return {
    post,
    inbounds: directInbounds,
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      scheduledAt: meeting.scheduledAt,
      outcome: meeting.outcome,
      meetingType: meeting.meetingType,
      notes: meeting.notes
    })),
    opportunities
  };
}

export async function getAttributionRows(window: AnalyticsWindow): Promise<PostAttributionRow[]> {
  const [posts, attributionRows] = await Promise.all([
    prisma.contentPost.findMany({
      where: {
        clientId: window.clientId,
        OR: [
          {
            postedAt: {
              gte: window.startDate,
              lte: window.endDate
            }
          },
          { postedAt: null }
        ]
      },
      orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }]
    }),
    readAttributionResults(window)
  ]);

  const attributionMap = new Map(attributionRows.map((row) => [row.postId, row]));

  return posts.map((post) => {
    const row = attributionMap.get(post.id);
    const meetings = row?.meetingsInfluencedCount ?? 0;
    const pipeline = row?.pipelineCreatedAmount ?? 0;
    const revenue = row?.revenueWonAmount ?? 0;
    const roiScore = post.impressions === 0 ? 0 : (revenue + pipeline * 0.35) / post.impressions;
    const confidence = row?.confidence ?? AttributionConfidence.UNATTRIBUTED;

    return {
      postId: post.id,
      postHook: post.hook,
      theme: post.theme,
      format: post.format,
      postedAt: post.postedAt,
      impressions: post.impressions,
      meetings,
      pipeline,
      revenue,
      roiScore,
      confidence
    };
  });
}

export async function getPipelineData(window: AnalyticsWindow): Promise<PipelineResult> {
  const dataset = await loadDataset(window);

  const funnel: FunnelMetrics = {
    inboundSignals: dataset.inboundsInRange.length,
    meetingsHeld: dataset.meetingsInRange.filter((meeting) => meeting.outcome === MeetingOutcome.held).length,
    opportunitiesCreated: dataset.opportunitiesInRange.length,
    closedWon: dataset.opportunitiesInRange.filter((opp) => opp.stage === OpportunityStage.closed_won).length
  };

  const opportunities: OpportunityListItem[] = dataset.opportunitiesInRange.map((opportunity) => {
    const attribution = dataset.opportunityAttribution.get(opportunity.id);
    const sourcePost = dataset.attributionPosts.find((post) => post.id === attribution?.attributedPostId);

    return {
      id: opportunity.id,
      stage: opportunity.stage,
      amount: opportunity.amount,
      createdAt: opportunity.createdAt,
      closedAt: opportunity.closedAt,
      sourcePostId: sourcePost?.id ?? null,
      sourceHook: sourcePost?.hook ?? null
    };
  });

  const stageMap = new Map<OpportunityStage, StageDistributionItem>();
  for (const opportunity of dataset.opportunitiesInRange) {
    const existing =
      stageMap.get(opportunity.stage) ??
      ({
        stage: opportunity.stage,
        count: 0,
        amount: 0
      } satisfies StageDistributionItem);

    existing.count += 1;
    existing.amount += opportunity.amount;
    stageMap.set(opportunity.stage, existing);
  }

  const stageDistribution = Array.from(stageMap.values()).sort((a, b) => b.amount - a.amount);

  return {
    funnel,
    opportunities,
    stageDistribution
  };
}

export async function getInsightsStats(window: AnalyticsWindow): Promise<{
  overview: OverviewResult;
  postingDays: Array<{ day: string; revenue: number; meetings: number }>;
}> {
  const overview = await getOverviewData(window);
  const dataset = await loadDataset(window);

  const dayMap = new Map<string, { day: string; revenue: number; meetings: number }>();

  for (const post of dataset.postsInRange) {
    if (!post.postedAt) continue;
    const day = format(post.postedAt, "EEEE");
    const item = dayMap.get(day) ?? { day, revenue: 0, meetings: 0 };
    item.meetings += 0;
    dayMap.set(day, item);
  }

  const meetingByPost = new Map<string, number>();
  for (const meeting of dataset.meetingsInRange) {
    const postId = dataset.meetingAttribution.get(meeting.id)?.attributedPostId;
    if (!postId) continue;
    meetingByPost.set(postId, (meetingByPost.get(postId) ?? 0) + 1);
  }

  const revenueByPost = new Map<string, number>();
  for (const opportunity of dataset.opportunitiesInRange) {
    if (opportunity.stage !== OpportunityStage.closed_won) continue;
    const postId = dataset.opportunityAttribution.get(opportunity.id)?.attributedPostId;
    if (!postId) continue;
    revenueByPost.set(postId, (revenueByPost.get(postId) ?? 0) + opportunity.amount);
  }

  for (const post of dataset.postsInRange) {
    if (!post.postedAt) continue;
    const day = format(post.postedAt, "EEEE");
    const item = dayMap.get(day) ?? { day, revenue: 0, meetings: 0 };
    item.meetings += meetingByPost.get(post.id) ?? 0;
    item.revenue += revenueByPost.get(post.id) ?? 0;
    dayMap.set(day, item);
  }

  const postingDays = Array.from(dayMap.values()).sort((a, b) => b.revenue - a.revenue);

  return {
    overview,
    postingDays
  };
}

export function toCSV(rows: PostAttributionRow[]): string {
  const headers = [
    "Post Hook",
    "Theme",
    "Format",
    "Posted At",
    "Impressions",
    "Meetings",
    "Pipeline",
    "Revenue",
    "ROI Score",
    "Confidence"
  ];

  const line = (values: Array<string | number>): string =>
    values
      .map((value) => {
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes("\"")) {
          return `"${stringValue.replaceAll("\"", "\"\"")}"`;
        }
        return stringValue;
      })
      .join(",");

  const body = rows.map((row) =>
    line([
      row.postHook ?? "",
      row.theme,
      row.format,
      row.postedAt ? row.postedAt.toISOString() : "",
      row.impressions,
      row.meetings,
      row.pipeline,
      row.revenue,
      row.roiScore.toFixed(4),
      row.confidence
    ])
  );

  return [line(headers), ...body].join("\n");
}

export function computeWeeklyBuckets(startDate: Date, endDate: Date): string[] {
  const buckets: string[] = [];
  let cursor = startOfWeek(startDate, { weekStartsOn: 1 });
  const finalWeek = endOfWeek(endDate, { weekStartsOn: 1 });

  while (cursor <= finalWeek) {
    buckets.push(format(cursor, "yyyy-MM-dd"));
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return buckets;
}
