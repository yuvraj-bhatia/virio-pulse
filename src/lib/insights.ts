import type { AnalyticsWindow } from "@/lib/analytics";
import { getInsightsStats } from "@/lib/analytics";
import type { InsightOutput } from "@/types";

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);
}

export function buildHeuristicInsights(stats: Awaited<ReturnType<typeof getInsightsStats>>): string[] {
  const topTheme = stats.overview.themePerformance[0];
  const bottomTheme = stats.overview.themePerformance[stats.overview.themePerformance.length - 1];
  const topHook = stats.overview.topHooks[0];
  const topDay = stats.postingDays[0];

  const noAttributionData =
    stats.overview.kpis.meetingsInfluenced === 0 &&
    stats.overview.kpis.pipelineCreated === 0 &&
    stats.overview.kpis.revenueWon === 0 &&
    !topTheme &&
    !topHook;

  if (noAttributionData) {
    return [
      "Import LinkedIn post URLs to populate your attribution workspace.",
      "Fill missing hook and postedAt fields so posts are attribution-ready.",
      "Add at least one inbound signal linked to a post or entry-point URL.",
      "Create an opportunity and set stage progression to generate pipeline impact.",
      "Recompute attribution and generate the weekly report to close the loop."
    ];
  }

  const items: string[] = [];

  if (topTheme) {
    items.push(
      `Double down on ${topTheme.theme}: ${topTheme.meetings} meetings and ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(topTheme.revenue)} influenced.`
    );
  }

  if (topHook) {
    items.push(`Reuse the strongest hook pattern: \"${topHook.hook}\" (${topHook.meetings} meetings influenced).`);
  }

  if (topDay) {
    items.push(
      `Prioritize ${topDay.day} posting windows; it currently leads with ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(topDay.revenue)} influenced revenue.`
    );
  }

  if (bottomTheme) {
    items.push(`De-prioritize ${bottomTheme.theme} for now and test a tighter CTA to recover conversion quality.`);
  }

  items.push("Ship two pricing/ROI variants next week and track meeting-to-win conversion by executive.");

  return items.slice(0, 5);
}

async function runAIInsights(
  stats: Awaited<ReturnType<typeof getInsightsStats>>,
  options: { apiKey: string; baseUrl: string; model: string }
): Promise<string[]> {
  const payload = {
    model: options.model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a GTM ops analyst. Return concise action-oriented bullet recommendations. Max 5 bullets, each under 20 words."
      },
      {
        role: "user",
        content: JSON.stringify({
          summary: stats.overview.kpis,
          topThemes: stats.overview.themePerformance.slice(0, 4),
          topHooks: stats.overview.topHooks,
          postingDays: stats.postingDays.slice(0, 4)
        })
      }
    ]
  };

  const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Insights API failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Insights API returned empty content");
  }

  const lines = cleanLines(text);
  if (lines.length === 0) {
    throw new Error("Insights API returned no parseable lines");
  }

  return lines;
}

export async function generateInsights(window: AnalyticsWindow): Promise<InsightOutput> {
  const stats = await getInsightsStats(window);
  const heuristicItems = buildHeuristicInsights(stats);

  const apiKey = process.env.INSIGHTS_AI_KEY?.trim();
  const baseUrl = process.env.INSIGHTS_AI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const model = process.env.INSIGHTS_AI_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    return {
      mode: "heuristic",
      usingHeuristics: true,
      items: heuristicItems
    };
  }

  try {
    const aiItems = await runAIInsights(stats, {
      apiKey,
      baseUrl,
      model
    });

    return {
      mode: "ai",
      usingHeuristics: false,
      items: aiItems
    };
  } catch (error) {
    console.error(error);
    return {
      mode: "heuristic",
      usingHeuristics: true,
      items: heuristicItems
    };
  }
}
