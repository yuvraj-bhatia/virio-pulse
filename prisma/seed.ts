import {
  AttributionConfidence,
  CtaType,
  InboundSource,
  MeetingOutcome,
  MeetingType,
  OpportunityStage,
  PostFormat,
  PostStatus,
  PrismaClient
} from "@prisma/client";

const prisma = new PrismaClient();

const themes = ["pricing", "security", "ROI", "case study", "hiring", "product launches"] as const;
const formats = [PostFormat.post, PostFormat.thread, PostFormat.carousel] as const;
const inboundSources = [
  InboundSource.linkedin_comment,
  InboundSource.linkedin_dm,
  InboundSource.website,
  InboundSource.referral
] as const;

type Theme = (typeof themes)[number];

type SeedClient = {
  name: string;
  domain: string;
  vertical: string;
  executives: Array<{ name: string; role: string; linkedinHandle: string }>;
};

const seedClients: SeedClient[] = [
  {
    name: "Northstar Cloud",
    domain: "northstarcloud.io",
    vertical: "B2B SaaS",
    executives: [
      { name: "Maya Chen", role: "CEO", linkedinHandle: "mayachen" },
      { name: "Evan Ross", role: "VP Sales", linkedinHandle: "evanross" }
    ]
  },
  {
    name: "HelioSec",
    domain: "heliosec.com",
    vertical: "Cybersecurity",
    executives: [
      { name: "Nadia Patel", role: "Founder", linkedinHandle: "nadiapatel" },
      { name: "Tom Barrett", role: "Chief Revenue Officer", linkedinHandle: "tombarrett" }
    ]
  },
  {
    name: "Riverlane Analytics",
    domain: "riverlane.ai",
    vertical: "Data Infrastructure",
    executives: [
      { name: "Jordan Kim", role: "CEO", linkedinHandle: "jordankim" },
      { name: "Priya Singh", role: "Head of Growth", linkedinHandle: "priyasingh" }
    ]
  }
];

function rng(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

const random = rng(42);

function sample<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(randomInt(8, 19), randomInt(0, 59), 0, 0);
  return date;
}

function pickTheme(): Theme {
  const roll = random();
  if (roll < 0.2) return "pricing";
  if (roll < 0.38) return "ROI";
  if (roll < 0.53) return "security";
  if (roll < 0.72) return "case study";
  if (roll < 0.86) return "product launches";
  return "hiring";
}

function engagementProfile(theme: Theme): { impressions: number; likes: number; comments: number; shares: number } {
  const highEngagement = theme === "hiring" || theme === "product launches";
  const lowEngagementHighIntent = theme === "pricing" || theme === "ROI" || theme === "security";

  if (highEngagement) {
    const impressions = randomInt(22000, 98000);
    return {
      impressions,
      likes: Math.round(impressions * (0.025 + random() * 0.018)),
      comments: Math.round(impressions * (0.004 + random() * 0.006)),
      shares: Math.round(impressions * (0.002 + random() * 0.004))
    };
  }

  if (lowEngagementHighIntent) {
    const impressions = randomInt(5000, 34000);
    return {
      impressions,
      likes: Math.round(impressions * (0.012 + random() * 0.01)),
      comments: Math.round(impressions * (0.003 + random() * 0.005)),
      shares: Math.round(impressions * (0.001 + random() * 0.003))
    };
  }

  const impressions = randomInt(9000, 42000);
  return {
    impressions,
    likes: Math.round(impressions * (0.014 + random() * 0.012)),
    comments: Math.round(impressions * (0.003 + random() * 0.005)),
    shares: Math.round(impressions * (0.001 + random() * 0.0035))
  };
}

function conversionProbability(theme: Theme): number {
  switch (theme) {
    case "pricing":
      return 0.55;
    case "ROI":
      return 0.5;
    case "security":
      return 0.45;
    case "case study":
      return 0.35;
    case "product launches":
      return 0.2;
    case "hiring":
      return 0.1;
  }
}

function ctaForTheme(theme: Theme): CtaType {
  if (theme === "pricing" || theme === "ROI" || theme === "case study") return CtaType.book_call;
  if (theme === "security") return sample([CtaType.dm, CtaType.book_call]);
  return sample([CtaType.dm, CtaType.none]);
}

function stageFromRoll(roll: number): OpportunityStage {
  if (roll < 0.35) return OpportunityStage.qualified;
  if (roll < 0.58) return OpportunityStage.proposal;
  if (roll < 0.76) return OpportunityStage.negotiation;
  if (roll < 0.9) return OpportunityStage.closed_won;
  return OpportunityStage.closed_lost;
}

async function main(): Promise<void> {
  await prisma.$transaction([
    prisma.report.deleteMany(),
    prisma.opportunity.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.inboundSignal.deleteMany(),
    prisma.contentPost.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.executive.deleteMany(),
    prisma.client.deleteMany()
  ]);

  for (const seedClient of seedClients) {
    const client = await prisma.client.create({
      data: {
        name: seedClient.name,
        domain: seedClient.domain,
        vertical: seedClient.vertical
      }
    });

    const executives = await Promise.all(
      seedClient.executives.map((executive) =>
        prisma.executive.create({
          data: {
            clientId: client.id,
            ...executive
          }
        })
      )
    );

    await prisma.appSetting.create({
      data: {
        clientId: client.id,
        attributionWindowDays: 7,
        useSoftAttribution: true
      }
    });

    const postsCount = randomInt(14, 28);
    const posts = [] as Array<{
      id: string;
      executiveId: string;
      postedAt: Date;
      theme: Theme;
      status: PostStatus;
    }>;

    for (let i = 0; i < postsCount; i += 1) {
      const executive = sample(executives);
      const theme = pickTheme();
      const postedAt = daysAgo(randomInt(0, 89));
      const profile = engagementProfile(theme);
      const status = random() < 0.76 ? PostStatus.posted : random() < 0.6 ? PostStatus.scheduled : PostStatus.draft;
      const hook = `${theme.toUpperCase()} angle: ${sample([
        "why buyers stall at stage 2",
        "what changed in 2026 buying committees",
        "how top reps frame ROI in first calls",
        "why your security narrative leaks trust",
        "building urgency without discounting",
        "lessons from 12 enterprise wins"
      ])}`;

      const body = [
        "Most teams optimize for impressions. Enterprise buyers optimize for confidence.",
        `This post breaks down a ${theme} narrative that moved conversations from interest to meetings.`,
        "If this resonates, comment \"PLAYBOOK\" and we will share the operator checklist."
      ].join(" ");

      const post = await prisma.contentPost.create({
        data: {
          clientId: client.id,
          executiveId: executive.id,
          postedAt,
          format: sample(formats),
          theme,
          hook,
          body,
          impressions: profile.impressions,
          likes: profile.likes,
          comments: profile.comments,
          shares: profile.shares,
          ctaType: ctaForTheme(theme),
          status
        }
      });

      posts.push({ id: post.id, executiveId: executive.id, postedAt, theme, status });
    }

    const sortedPosts = posts.filter((post) => post.status === PostStatus.posted).sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

    const inbounds = [] as Array<{ id: string; postId: string | null; executiveId: string | null; createdAt: Date }>;

    for (const post of sortedPosts) {
      if (random() < conversionProbability(post.theme)) {
        const directCount = randomInt(1, 3);
        for (let i = 0; i < directCount; i += 1) {
          const createdAt = new Date(post.postedAt);
          createdAt.setDate(createdAt.getDate() + randomInt(0, 7));

          const inbound = await prisma.inboundSignal.create({
            data: {
              clientId: client.id,
              postId: post.id,
              executiveId: post.executiveId,
              source: sample(inboundSources),
              personName: sample(["Alex Rivera", "Lena Hart", "Chris Doyle", "Mia Soto", "Rohan Das", "Natalie Park"]),
              company: sample(["Vector Labs", "NovaPeak", "BlueArc", "SummitOne", "Artemis Systems"]),
              title: sample(["VP Sales", "Head of RevOps", "CRO", "Founder", "Director of Demand Gen"]),
              entryPointUrl: `https://linkedin.com/feed/update/${post.id.slice(-10)}`,
              createdAt
            }
          });

          inbounds.push({ id: inbound.id, postId: post.id, executiveId: post.executiveId, createdAt });
        }
      }

      if (random() < 0.26) {
        const createdAt = new Date(post.postedAt);
        createdAt.setDate(createdAt.getDate() + randomInt(1, 9));
        const inbound = await prisma.inboundSignal.create({
          data: {
            clientId: client.id,
            postId: null,
            executiveId: post.executiveId,
            source: sample([InboundSource.website, InboundSource.linkedin_dm, InboundSource.referral]),
            personName: sample(["Sam King", "Priyanka Rao", "Oscar Reed", "Noah Hale", "Emma Cruz"]),
            company: sample(["GraniteAI", "JunoWare", "VelaStack", "OrbitOps"]),
            title: sample(["Head of Marketing", "CEO", "VP Revenue", "Director of Growth"]),
            entryPointUrl: random() < 0.5 ? `https://${client.domain}/contact` : null,
            createdAt
          }
        });
        inbounds.push({ id: inbound.id, postId: null, executiveId: post.executiveId, createdAt });
      }
    }

    for (let i = 0; i < randomInt(4, 8); i += 1) {
      const inbound = await prisma.inboundSignal.create({
        data: {
          clientId: client.id,
          postId: null,
          executiveId: null,
          source: sample([InboundSource.website, InboundSource.referral]),
          personName: sample(["Avery Moss", "Kian Shah", "Grace Lin", "Diana Flores"]),
          company: sample(["VertexWorks", "PraxisOne", "ArgoCloud", "Northwind Ops"]),
          title: sample(["CEO", "CFO", "COO", "VP Sales"]),
          entryPointUrl: random() < 0.75 ? `https://${client.domain}/book-demo` : null,
          createdAt: daysAgo(randomInt(0, 89))
        }
      });

      inbounds.push({ id: inbound.id, postId: null, executiveId: null, createdAt: inbound.createdAt });
    }

    for (const inbound of inbounds) {
      if (random() > 0.64) continue;

      const scheduledAt = new Date(inbound.createdAt);
      scheduledAt.setDate(scheduledAt.getDate() + randomInt(1, 14));
      const outcome = sample([MeetingOutcome.held, MeetingOutcome.held, MeetingOutcome.rescheduled, MeetingOutcome.no_show]);

      const meeting = await prisma.meeting.create({
        data: {
          clientId: client.id,
          inboundId: inbound.id,
          scheduledAt,
          outcome,
          meetingType: sample([MeetingType.discovery, MeetingType.demo, MeetingType.exec]),
          notes: sample([
            "Prospect referenced executive post directly during call opening.",
            "Inbound mentioned pricing narrative and asked for ROI model.",
            "Security questions surfaced; moved to technical follow-up.",
            "Discovery focused on implementation timeline and budget ownership."
          ])
        }
      });

      if (meeting.outcome !== MeetingOutcome.held || random() > 0.72) continue;

      const stage = stageFromRoll(random());
      const amount = randomInt(18000, 210000);
      const createdAt = new Date(meeting.scheduledAt);
      createdAt.setDate(createdAt.getDate() + randomInt(0, 10));

      const closedAt =
        stage === OpportunityStage.closed_won || stage === OpportunityStage.closed_lost
          ? new Date(createdAt.getTime() + randomInt(7, 40) * 24 * 60 * 60 * 1000)
          : null;

      await prisma.opportunity.create({
        data: {
          clientId: client.id,
          meetingId: meeting.id,
          stage,
          amount,
          createdAt,
          closedAt
        }
      });
    }

    // A few manually curated outliers for demo storytelling.
    const hiringPost = sortedPosts.find((post) => post.theme === "hiring");
    const pricingPost = sortedPosts.find((post) => post.theme === "pricing");

    if (hiringPost) {
      const highImpressions = await prisma.contentPost.update({
        where: { id: hiringPost.id },
        data: {
          impressions: 120000,
          likes: 3400,
          comments: 600,
          shares: 290
        }
      });
      if (highImpressions) {
        const inbound = await prisma.inboundSignal.create({
          data: {
            clientId: client.id,
            postId: hiringPost.id,
            executiveId: hiringPost.executiveId,
            source: InboundSource.linkedin_comment,
            personName: "Outlier Prospect",
            company: "TalentStack",
            title: "VP People",
            entryPointUrl: `https://linkedin.com/feed/update/${hiringPost.id.slice(-10)}`,
            createdAt: new Date(hiringPost.postedAt.getTime() + 2 * 24 * 60 * 60 * 1000)
          }
        });

        await prisma.meeting.create({
          data: {
            clientId: client.id,
            inboundId: inbound.id,
            scheduledAt: new Date(hiringPost.postedAt.getTime() + 5 * 24 * 60 * 60 * 1000),
            outcome: MeetingOutcome.held,
            meetingType: MeetingType.discovery,
            notes: "High engagement post but weak buying intent."
          }
        });
      }
    }

    if (pricingPost) {
      const inbound = await prisma.inboundSignal.create({
        data: {
          clientId: client.id,
          postId: pricingPost.id,
          executiveId: pricingPost.executiveId,
          source: InboundSource.linkedin_dm,
          personName: "Enterprise Buyer",
          company: "Atlas ERP",
          title: "CRO",
          entryPointUrl: `https://linkedin.com/feed/update/${pricingPost.id.slice(-10)}`,
          createdAt: new Date(pricingPost.postedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
        }
      });

      const meeting = await prisma.meeting.create({
        data: {
          clientId: client.id,
          inboundId: inbound.id,
          scheduledAt: new Date(pricingPost.postedAt.getTime() + 6 * 24 * 60 * 60 * 1000),
          outcome: MeetingOutcome.held,
          meetingType: MeetingType.exec,
          notes: "Low engagement post that drove high-intent enterprise conversation."
        }
      });

      await prisma.opportunity.create({
        data: {
          clientId: client.id,
          meetingId: meeting.id,
          stage: OpportunityStage.closed_won,
          amount: 260000,
          createdAt: new Date(meeting.scheduledAt.getTime() + 2 * 24 * 60 * 60 * 1000),
          closedAt: new Date(meeting.scheduledAt.getTime() + 24 * 24 * 60 * 60 * 1000)
        }
      });
    }

    // Keep TypeScript from stripping imported enum in optimized build path.
    void AttributionConfidence.LOW;
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
