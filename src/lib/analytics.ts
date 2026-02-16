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

import { prisma } from "@/lib/db";
import {
  mergeConfidence,
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
    postedAt: Date;
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

  const inboundAttribution = resolveInboundAttributions(inboundsInRange, attributionPosts, settings);
  const meetingAttribution = resolveMeetingAttributions(meetingsInRange, inboundAttribution);
  const opportunityAttribution = resolveOpportunityAttributions(opportunitiesInRange, meetingAttribution);

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

export async function getOverviewData(window: AnalyticsWindow): Promise<OverviewResult> {
  const dataset = await loadDataset(window);
  const postedPosts = dataset.postsInRange.filter((post) => post.status === PostStatus.posted);

  const meetingsInfluenced = dataset.meetingsInRange.filter((meeting) => {
    const attribution = dataset.meetingAttribution.get(meeting.id);
    return Boolean(attribution?.attributedPostId);
  }).length;

  const wins = dataset.opportunitiesInRange.filter((opp) => opp.stage === OpportunityStage.closed_won);
  const attributedWins = wins.filter((opp) => {
    const attribution = dataset.opportunityAttribution.get(opp.id);
    return Boolean(attribution?.attributedPostId);
  });

  const pipelineCreated = dataset.opportunitiesInRange.reduce((sum, opportunity) => sum + opportunity.amount, 0);
  const revenueWon = attributedWins.reduce((sum, opportunity) => sum + opportunity.amount, 0);

  const postsCount = Math.max(postedPosts.length, 1);
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

  const byPost = postedPosts.map((post) => ({
    postId: post.id,
    theme: post.theme,
    format: post.format,
    postedAt: post.postedAt,
    hook: post.hook,
    meetings: meetingsByPost.get(post.id) ?? 0,
    revenue: revenueByPost.get(post.id) ?? 0
  }));

  const topPostsByRevenue = byPost.sort((a, b) => b.revenue - a.revenue).slice(0, 10);

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
  const delta = previousRevenue === 0 ? 1 : (revenueWon - previousRevenue) / previousRevenue;
  const direction = delta >= 0 ? "up" : "down";
  const changePercent = `${Math.abs(delta * 100).toFixed(1)}%`;

  const whatChanged = `Revenue influence is ${direction} ${changePercent} versus the prior period. ${
    revenueWon > pipelineCreated * 0.25
      ? "Closed-won velocity improved; prioritize pricing and ROI narratives."
      : "Pipeline is forming but win conversion is lagging; tighten qualification hooks."
  }`;

  const themeMap = new Map<string, ThemePerformance>();
  for (const post of postedPosts) {
    if (!themeMap.has(post.theme)) {
      themeMap.set(post.theme, {
        theme: post.theme,
        meetings: 0,
        revenue: 0,
        posts: 0
      });
    }
    const entry = themeMap.get(post.theme);
    if (!entry) continue;
    entry.posts += 1;
    entry.meetings += meetingsByPost.get(post.id) ?? 0;
    entry.revenue += revenueByPost.get(post.id) ?? 0;
  }

  const themePerformance = Array.from(themeMap.values()).sort((a, b) => b.revenue - a.revenue);

  const hookPerformance: HookPerformance[] = postedPosts
    .map((post) => ({
      hook: post.hook,
      meetings: meetingsByPost.get(post.id) ?? 0
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
    postedAt: {
      gte: window.startDate,
      lte: window.endDate
    }
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
    orderBy: { postedAt: "desc" }
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
    where: { postId: post.id },
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
      meetingId: {
        in: meetings.map((meeting) => meeting.id)
      }
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
  const dataset = await loadDataset(window);

  const meetingsByPost = new Map<string, number>();
  const pipelineByPost = new Map<string, number>();
  const revenueByPost = new Map<string, number>();
  const confidenceByPost = new Map<string, AttributionConfidence[]>();

  for (const inbound of dataset.inboundsInRange) {
    const attribution = dataset.inboundAttribution.get(inbound.id);
    if (!attribution?.attributedPostId) continue;

    const confidenceBucket = confidenceByPost.get(attribution.attributedPostId) ?? [];
    confidenceBucket.push(attribution.confidence);
    confidenceByPost.set(attribution.attributedPostId, confidenceBucket);
  }

  for (const meeting of dataset.meetingsInRange) {
    const attribution = dataset.meetingAttribution.get(meeting.id);
    if (!attribution?.attributedPostId) continue;
    meetingsByPost.set(attribution.attributedPostId, (meetingsByPost.get(attribution.attributedPostId) ?? 0) + 1);

    const confidenceBucket = confidenceByPost.get(attribution.attributedPostId) ?? [];
    confidenceBucket.push(attribution.confidence);
    confidenceByPost.set(attribution.attributedPostId, confidenceBucket);
  }

  for (const opportunity of dataset.opportunitiesInRange) {
    const attribution = dataset.opportunityAttribution.get(opportunity.id);
    if (!attribution?.attributedPostId) continue;

    pipelineByPost.set(
      attribution.attributedPostId,
      (pipelineByPost.get(attribution.attributedPostId) ?? 0) + opportunity.amount
    );

    if (opportunity.stage === OpportunityStage.closed_won) {
      revenueByPost.set(
        attribution.attributedPostId,
        (revenueByPost.get(attribution.attributedPostId) ?? 0) + opportunity.amount
      );
    }

    const confidenceBucket = confidenceByPost.get(attribution.attributedPostId) ?? [];
    confidenceBucket.push(attribution.confidence);
    confidenceByPost.set(attribution.attributedPostId, confidenceBucket);
  }

  return dataset.postsInRange.map((post) => {
    const meetings = meetingsByPost.get(post.id) ?? 0;
    const pipeline = pipelineByPost.get(post.id) ?? 0;
    const revenue = revenueByPost.get(post.id) ?? 0;
    const roiScore = post.impressions === 0 ? 0 : (revenue + pipeline * 0.35) / post.impressions;
    const confidence = mergeConfidence(confidenceByPost.get(post.id) ?? [AttributionConfidence.LOW]);

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
      row.postHook,
      row.theme,
      row.format,
      row.postedAt.toISOString(),
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
