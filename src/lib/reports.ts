import { format } from "date-fns";

import { getOverviewData } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import type { WeeklyReportPayload } from "@/types";

export type ReportViewMode = "internal" | "client_safe";

function createRecommendations(topTheme: string | undefined): string[] {
  return [
    topTheme
      ? `Prioritize two new ${topTheme} narratives and run A/B hooks by executive.`
      : "Prioritize high-intent themes tied to pricing and ROI signals.",
    "Tighten CTA from generic " + "comment prompts to direct meeting intent.",
    "Review no-show meetings and refine pre-call qualification in outbound follow-up."
  ];
}

function buildMarkdown(
  viewMode: ReportViewMode,
  data: Awaited<ReturnType<typeof getOverviewData>>,
  context: { clientName: string; rangeLabel: string; generatedAt: Date }
): string {
  const topTheme = data.themePerformance[0]?.theme;
  const lowTheme = data.themePerformance[data.themePerformance.length - 1]?.theme;
  const recommendations = createRecommendations(topTheme);

  const lines: string[] = [];
  lines.push(`# Pulse Weekly Report (${viewMode === "internal" ? "Internal" : "Client-safe"})`);
  lines.push("");
  lines.push(`- Client: ${context.clientName}`);
  lines.push(`- Range: ${context.rangeLabel}`);
  lines.push(`- Generated: ${format(context.generatedAt, "PPpp")}`);
  lines.push("");

  lines.push("## KPI Snapshot");
  lines.push("");
  lines.push(`- Meetings Influenced: ${data.kpis.meetingsInfluenced}`);
  lines.push(`- Pipeline Created: $${data.kpis.pipelineCreated.toLocaleString("en-US")}`);
  lines.push(`- Revenue Won: $${data.kpis.revenueWon.toLocaleString("en-US")}`);
  lines.push(`- Content-to-Meeting: ${(data.kpis.contentToMeetingRate * 100).toFixed(1)}%`);
  lines.push(`- Meeting-to-Win: ${(data.kpis.meetingToWinRate * 100).toFixed(1)}%`);
  lines.push("");

  lines.push("## Top Posts by Revenue Influence");
  lines.push("");
  for (const post of data.topPostsByRevenue.slice(0, 5)) {
    lines.push(
      `- ${post.theme} | ${post.format} | ${post.postedAt ? format(post.postedAt, "PP") : "No date"}: ${post.meetings} meetings, $${post.revenue.toLocaleString("en-US")}`
    );
  }
  lines.push("");

  lines.push("## Theme Winners and Losers");
  lines.push("");
  if (topTheme) {
    const top = data.themePerformance[0];
    lines.push(`- Winner: ${top.theme} (${top.meetings} meetings, $${top.revenue.toLocaleString("en-US")})`);
  }
  if (lowTheme) {
    const low = data.themePerformance[data.themePerformance.length - 1];
    lines.push(`- Watchlist: ${low.theme} (${low.meetings} meetings, $${low.revenue.toLocaleString("en-US")})`);
  }
  lines.push("");

  lines.push("## Next-Week Recommendations");
  lines.push("");
  for (const recommendation of recommendations) {
    lines.push(`- ${recommendation}`);
  }

  if (viewMode === "internal") {
    lines.push("");
    lines.push("## Internal Notes");
    lines.push("");
    lines.push(`- ${data.whatChanged}`);
    lines.push("- Investigate medium-confidence attributions weekly to harden source instrumentation.");
    lines.push("- Escalate low-confidence inbound volume if it rises above 20% of total inbounds.");
  }

  if (viewMode === "client_safe") {
    lines.push("");
    lines.push("## Client-safe Narrative");
    lines.push("");
    lines.push("- Content strategy continues to improve pipeline quality and speed to first meetings.");
    lines.push("- Next sprint will focus on high-converting themes and tighter executive CTA framing.");
  }

  lines.push("");
  return lines.join("\n");
}

export async function generateWeeklyReport(params: {
  clientId: string;
  startDate: Date;
  endDate: Date;
  rangePreset: string;
  viewMode: ReportViewMode;
}): Promise<WeeklyReportPayload> {
  const client = await prisma.client.findUnique({ where: { id: params.clientId } });
  if (!client) {
    throw new Error("Client not found");
  }

  const data = await getOverviewData({
    clientId: params.clientId,
    startDate: params.startDate,
    endDate: params.endDate
  });

  const markdown = buildMarkdown(params.viewMode, data, {
    clientName: client.name,
    rangeLabel: `${format(params.startDate, "PP")} - ${format(params.endDate, "PP")}`,
    generatedAt: new Date()
  });

  const report = await prisma.report.create({
    data: {
      clientId: params.clientId,
      rangePreset: params.rangePreset,
      startDate: params.startDate,
      endDate: params.endDate,
      viewMode: params.viewMode,
      markdown
    }
  });

  const stamp = format(new Date(report.createdAt), "yyyy-MM-dd");
  const filename = `${client.name.toLowerCase().replace(/\s+/g, "-")}-${params.viewMode}-${stamp}.md`;

  return {
    id: report.id,
    clientId: report.clientId,
    rangePreset: report.rangePreset,
    viewMode: report.viewMode,
    markdown: report.markdown,
    createdAt: report.createdAt.toISOString(),
    filename
  };
}

export async function listReports(clientId: string): Promise<WeeklyReportPayload[]> {
  const reports = await prisma.report.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const clientName = client?.name.toLowerCase().replace(/\s+/g, "-") ?? "client";

  return reports.map((report) => ({
    id: report.id,
    clientId: report.clientId,
    rangePreset: report.rangePreset,
    viewMode: report.viewMode,
    markdown: report.markdown,
    createdAt: report.createdAt.toISOString(),
    filename: `${clientName}-${report.viewMode}-${format(report.createdAt, "yyyy-MM-dd")}.md`
  }));
}
