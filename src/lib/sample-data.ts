import {
  ClientDataMode,
  CtaType,
  InboundSource,
  MeetingOutcome,
  MeetingType,
  OpportunityStage,
  PostFormat,
  PostStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";
import { subDays } from "date-fns";

import { clearClientWorkspaceData } from "@/lib/workspace-data";

type DbClient = PrismaClient | Prisma.TransactionClient;

type ResetResult = {
  posts: number;
  inbounds: number;
  meetings: number;
  opportunities: number;
};

function atDayOffset(daysAgo: number, hour = 10): Date {
  const date = subDays(new Date(), daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export async function resetClientToSampleData(db: DbClient, clientId: string): Promise<ResetResult> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      executives: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  if (client.executives.length === 0) {
    await db.executive.createMany({
      data: [
        {
          clientId,
          name: `${client.name} Exec 1`,
          role: "CEO",
          linkedinHandle: `${client.name.toLowerCase().replace(/\s+/g, "")}-ceo`
        },
        {
          clientId,
          name: `${client.name} Exec 2`,
          role: "Head of Growth",
          linkedinHandle: `${client.name.toLowerCase().replace(/\s+/g, "")}-growth`
        }
      ]
    });
  }

  const executives = await db.executive.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" }
  });

  const primaryExecutive = executives[0];
  const secondaryExecutive = executives[1] ?? executives[0];

  await clearClientWorkspaceData(db, clientId);

  await db.appSetting.upsert({
    where: { clientId },
    create: {
      clientId,
      attributionWindowDays: 7,
      useSoftAttribution: true
    },
    update: {
      attributionWindowDays: 7,
      useSoftAttribution: true
    }
  });

  const postTemplates = [
    {
      executiveId: primaryExecutive.id,
      postedAt: atDayOffset(28, 9),
      format: PostFormat.thread,
      theme: "pricing",
      hook: "PRICING angle: why your security narrative leaks trust",
      body: "Pricing content with direct ROI language tuned for enterprise buying committees.",
      impressions: 22000,
      likes: 360,
      comments: 55,
      shares: 24,
      ctaType: CtaType.book_call,
      status: PostStatus.posted
    },
    {
      executiveId: secondaryExecutive.id,
      postedAt: atDayOffset(16, 10),
      format: PostFormat.post,
      theme: "product launches",
      hook: "PRODUCT LAUNCHES angle: why buyers stall at stage 2",
      body: "Launch narrative post designed to attract mid-funnel technical evaluators.",
      impressions: 32000,
      likes: 870,
      comments: 94,
      shares: 41,
      ctaType: CtaType.dm,
      status: PostStatus.posted
    },
    {
      executiveId: secondaryExecutive.id,
      postedAt: atDayOffset(12, 11),
      format: PostFormat.carousel,
      theme: "product launches",
      hook: "PRODUCT LAUNCHES angle: lessons from 12 enterprise wins",
      body: "Carousel summarizing operational wins and decision criteria from recent closed-won deals.",
      impressions: 31000,
      likes: 790,
      comments: 81,
      shares: 35,
      ctaType: CtaType.dm,
      status: PostStatus.posted
    },
    {
      executiveId: secondaryExecutive.id,
      postedAt: atDayOffset(8, 9),
      format: PostFormat.thread,
      theme: "hiring",
      hook: "HIRING angle: what changed in 2026 buying committees",
      body: "High-engagement narrative with weaker purchase intent.",
      impressions: 120000,
      likes: 3400,
      comments: 600,
      shares: 290,
      ctaType: CtaType.none,
      status: PostStatus.posted
    },
    {
      executiveId: primaryExecutive.id,
      postedAt: atDayOffset(6, 11),
      format: PostFormat.post,
      theme: "ROI",
      hook: "ROI angle: lessons from 12 enterprise wins",
      body: "ROI-oriented post that drives meeting requests from operators.",
      impressions: 23250,
      likes: 402,
      comments: 62,
      shares: 18,
      ctaType: CtaType.book_call,
      status: PostStatus.posted
    },
    {
      executiveId: primaryExecutive.id,
      postedAt: atDayOffset(3, 11),
      format: PostFormat.post,
      theme: "pricing",
      hook: "Pricing signal test hook",
      body: "Draft-style imported hook example for fast iteration.",
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      ctaType: CtaType.book_call,
      status: PostStatus.draft
    }
  ];

  const posts = [] as Array<{ id: string; postedAt: Date; executiveId: string }>;

  for (let index = 0; index < postTemplates.length; index += 1) {
    const template = postTemplates[index];
    const post = await db.contentPost.create({
      data: {
        clientId,
        ...template,
        postUrl: `https://www.linkedin.com/feed/update/${clientId.slice(-6)}-${index + 1}`
      }
    });

    posts.push({ id: post.id, postedAt: post.postedAt ?? template.postedAt, executiveId: post.executiveId });
  }

  const inboundDirect = await db.inboundSignal.create({
    data: {
      clientId,
      source: InboundSource.linkedin_dm,
      postId: posts[0]?.id,
      executiveId: posts[0]?.executiveId,
      createdAt: atDayOffset(26, 13),
      personName: "Enterprise Buyer",
      company: "Atlas ERP",
      title: "CRO",
      entryPointUrl: `https://www.linkedin.com/feed/update/${clientId.slice(-6)}-1`
    }
  });

  const inboundSoft = await db.inboundSignal.create({
    data: {
      clientId,
      source: InboundSource.website,
      postId: null,
      executiveId: posts[4]?.executiveId ?? primaryExecutive.id,
      createdAt: atDayOffset(5, 15),
      personName: "Ops Leader",
      company: "Vector Labs",
      title: "VP RevOps",
      entryPointUrl: `https://${client.domain}/contact`
    }
  });

  const inboundUnattributed = await db.inboundSignal.create({
    data: {
      clientId,
      source: InboundSource.referral,
      postId: null,
      executiveId: null,
      createdAt: atDayOffset(14, 16),
      personName: "Referral Lead",
      company: "Northwind",
      title: "Head of Sales",
      entryPointUrl: null
    }
  });

  const inboundAdditional = await db.inboundSignal.create({
    data: {
      clientId,
      source: InboundSource.linkedin_comment,
      postId: posts[2]?.id,
      executiveId: posts[2]?.executiveId,
      createdAt: atDayOffset(10, 13),
      personName: "Growth Director",
      company: "SummitOne",
      title: "Director of Growth",
      entryPointUrl: `https://www.linkedin.com/feed/update/${clientId.slice(-6)}-3`
    }
  });

  const meetings = await Promise.all([
    db.meeting.create({
      data: {
        clientId,
        inboundId: inboundDirect.id,
        scheduledAt: atDayOffset(24, 11),
        outcome: MeetingOutcome.held,
        meetingType: MeetingType.exec,
        notes: "Direct DM from pricing post resulted in executive meeting."
      }
    }),
    db.meeting.create({
      data: {
        clientId,
        inboundId: inboundSoft.id,
        scheduledAt: atDayOffset(4, 12),
        outcome: MeetingOutcome.held,
        meetingType: MeetingType.discovery,
        notes: "Website inbound likely influenced by recent ROI post."
      }
    }),
    db.meeting.create({
      data: {
        clientId,
        inboundId: inboundUnattributed.id,
        scheduledAt: atDayOffset(13, 11),
        outcome: MeetingOutcome.held,
        meetingType: MeetingType.discovery,
        notes: "Referral source with no attributable post signal."
      }
    }),
    db.meeting.create({
      data: {
        clientId,
        inboundId: inboundAdditional.id,
        scheduledAt: atDayOffset(9, 15),
        outcome: MeetingOutcome.no_show,
        meetingType: MeetingType.demo,
        notes: "Demo was scheduled but no-showed."
      }
    })
  ]);

  await Promise.all([
    db.opportunity.create({
      data: {
        clientId,
        name: "Atlas ERP enterprise expansion",
        meetingId: meetings[0].id,
        inboundSignalId: inboundDirect.id,
        postId: posts[0]?.id,
        stage: OpportunityStage.closed_won,
        amount: 260000,
        createdAt: atDayOffset(23, 10),
        closeDate: atDayOffset(18, 10),
        closedAt: atDayOffset(18, 10)
      }
    }),
    db.opportunity.create({
      data: {
        clientId,
        name: "Vector Labs platform rollout",
        meetingId: meetings[1].id,
        inboundSignalId: inboundSoft.id,
        postId: posts[4]?.id ?? null,
        stage: OpportunityStage.proposal,
        amount: 156805,
        createdAt: atDayOffset(3, 14),
        closeDate: null,
        closedAt: null
      }
    }),
    db.opportunity.create({
      data: {
        clientId,
        name: "Northwind referral pilot",
        meetingId: meetings[2].id,
        inboundSignalId: inboundUnattributed.id,
        postId: null,
        stage: OpportunityStage.closed_won,
        amount: 97650,
        createdAt: atDayOffset(12, 12),
        closeDate: atDayOffset(6, 9),
        closedAt: atDayOffset(6, 9)
      }
    })
  ]);

  await db.client.update({
    where: { id: clientId },
    data: { dataMode: ClientDataMode.sample }
  });

  return {
    posts: posts.length,
    inbounds: 4,
    meetings: meetings.length,
    opportunities: 3
  };
}
