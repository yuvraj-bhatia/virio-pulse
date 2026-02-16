import type {
  AttributionConfidence,
  CtaType,
  MeetingOutcome,
  MeetingType,
  OpportunityStage,
  PostFormat,
  PostStatus,
  ReportViewMode
} from "@prisma/client";

export type PostAttributionRow = {
  postId: string;
  postHook: string;
  theme: string;
  format: PostFormat;
  postedAt: Date;
  impressions: number;
  meetings: number;
  pipeline: number;
  revenue: number;
  roiScore: number;
  confidence: AttributionConfidence;
};

export type KpiSummary = {
  meetingsInfluenced: number;
  pipelineCreated: number;
  revenueWon: number;
  contentToMeetingRate: number;
  meetingToWinRate: number;
  revenuePerPost: number;
  meetingsPerPost: number;
};

export type WeeklySeriesPoint = {
  weekStart: string;
  meetingsInfluenced: number;
  revenueWon: number;
};

export type ThemePerformance = {
  theme: string;
  meetings: number;
  revenue: number;
  posts: number;
};

export type HookPerformance = {
  hook: string;
  meetings: number;
};

export type FunnelMetrics = {
  inboundSignals: number;
  meetingsHeld: number;
  opportunitiesCreated: number;
  closedWon: number;
};

export type OpportunityListItem = {
  id: string;
  stage: OpportunityStage;
  amount: number;
  createdAt: Date;
  closedAt: Date | null;
  sourcePostId: string | null;
  sourceHook: string | null;
};

export type StageDistributionItem = {
  stage: OpportunityStage;
  count: number;
  amount: number;
};

export type ContentListItem = {
  id: string;
  clientId: string;
  executiveId: string;
  executiveName: string;
  postedAt: Date;
  format: PostFormat;
  theme: string;
  hook: string;
  body: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  ctaType: CtaType;
  status: PostStatus;
};

export type InboundAttribution = {
  inboundId: string;
  postId: string | null;
  confidence: AttributionConfidence;
  isDirect: boolean;
  source: string;
};

export type InsightOutput = {
  mode: "ai" | "heuristic";
  usingHeuristics: boolean;
  items: string[];
};

export type WeeklyReportPayload = {
  id: string;
  clientId: string;
  rangePreset: string;
  viewMode: ReportViewMode;
  markdown: string;
  createdAt: string;
  filename: string;
};

export type MeetingDetail = {
  id: string;
  scheduledAt: Date;
  outcome: MeetingOutcome;
  meetingType: MeetingType;
  notes: string;
};
