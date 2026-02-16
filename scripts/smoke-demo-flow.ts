import { ClientDataMode, InboundSource, OpportunityStage, PostFormat, PostStatus, PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay, subDays } from "date-fns";

import { recomputeAttributionRange } from "@/lib/attribution-results";
import { getOverviewData } from "@/lib/analytics";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const client = await prisma.client.create({
    data: {
      name: "Smoke Demo Client",
      domain: "smoke-demo.local",
      vertical: "Testing",
      dataMode: ClientDataMode.real
    }
  });

  const executive = await prisma.executive.create({
    data: {
      clientId: client.id,
      name: "Smoke Exec",
      role: "Founder",
      linkedinHandle: "smoke-exec"
    }
  });

  const now = new Date();
  const post1 = await prisma.contentPost.create({
    data: {
      clientId: client.id,
      executiveId: executive.id,
      postUrl: "https://www.linkedin.com/posts/smoke-one",
      postedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      format: PostFormat.post,
      theme: "pricing",
      hook: "Smoke hook one",
      body: "Demo smoke flow post",
      status: PostStatus.ready
    }
  });

  await prisma.contentPost.create({
    data: {
      clientId: client.id,
      executiveId: executive.id,
      postUrl: "https://www.linkedin.com/posts/smoke-two",
      postedAt: null,
      format: PostFormat.post,
      theme: "General",
      hook: null,
      body: null,
      status: PostStatus.needs_details
    }
  });

  const inbound = await prisma.inboundSignal.create({
    data: {
      clientId: client.id,
      postId: post1.id,
      source: InboundSource.linkedin_dm,
      createdAt: now,
      personName: "Smoke Buyer"
    }
  });

  await prisma.opportunity.create({
    data: {
      clientId: client.id,
      name: "Smoke Deal",
      amount: 10000,
      stage: OpportunityStage.closed_won,
      createdAt: now,
      closeDate: now,
      closedAt: now,
      inboundSignalId: inbound.id
    }
  });

  await recomputeAttributionRange(prisma, client.id, 30);

  const attributed = await prisma.attributionResult.findUnique({
    where: {
      clientId_postId_windowRangeDays: {
        clientId: client.id,
        postId: post1.id,
        windowRangeDays: 30
      }
    }
  });

  if (!attributed || attributed.revenueWonAmount <= 0) {
    throw new Error("Expected attributed revenue for post 1");
  }

  const overview = await getOverviewData({
    clientId: client.id,
    startDate: startOfDay(subDays(endOfDay(new Date()), 29)),
    endDate: endOfDay(new Date())
  });

  if (overview.kpis.revenueWon <= 0 || overview.kpis.meetingsInfluenced <= 0) {
    throw new Error("Expected overview KPIs to reflect demo data");
  }

  await prisma.client.delete({ where: { id: client.id } });
  console.log("Smoke demo flow passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
