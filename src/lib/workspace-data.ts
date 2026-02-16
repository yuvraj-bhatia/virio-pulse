import { ClientDataMode, type Prisma, type PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type WorkspaceClearResult = {
  reports: number;
  opportunities: number;
  meetings: number;
  inbounds: number;
  posts: number;
};

async function requireClient(db: DbClient, clientId: string): Promise<{ id: string; dataMode: ClientDataMode }> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, dataMode: true }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  return client;
}

export async function clearClientWorkspaceData(db: DbClient, clientId: string): Promise<WorkspaceClearResult> {
  await requireClient(db, clientId);

  const reports = await db.report.deleteMany({ where: { clientId } });
  const opportunities = await db.opportunity.deleteMany({ where: { clientId } });
  const meetings = await db.meeting.deleteMany({ where: { clientId } });
  const inbounds = await db.inboundSignal.deleteMany({ where: { clientId } });
  const posts = await db.contentPost.deleteMany({ where: { clientId } });

  return {
    reports: reports.count,
    opportunities: opportunities.count,
    meetings: meetings.count,
    inbounds: inbounds.count,
    posts: posts.count
  };
}

export async function setClientDataMode(db: DbClient, clientId: string, dataMode: ClientDataMode): Promise<void> {
  await requireClient(db, clientId);
  await db.client.update({
    where: { id: clientId },
    data: { dataMode }
  });
}

export async function prepareClientForRealDataImport(
  db: DbClient,
  clientId: string
): Promise<{ clearedSampleData: boolean; clearResult: WorkspaceClearResult | null }> {
  const client = await requireClient(db, clientId);

  if (client.dataMode === ClientDataMode.sample) {
    const clearResult = await clearClientWorkspaceData(db, clientId);
    await setClientDataMode(db, clientId, ClientDataMode.real);
    return {
      clearedSampleData: true,
      clearResult
    };
  }

  await setClientDataMode(db, clientId, ClientDataMode.real);
  return {
    clearedSampleData: false,
    clearResult: null
  };
}
