import { PrismaClient } from "@prisma/client";

import { resetClientToSampleData } from "@/lib/sample-data";
import { clearClientWorkspaceData, setClientDataMode } from "@/lib/workspace-data";

const prisma = new PrismaClient();

type ClientCounts = {
  posts: number;
  inbounds: number;
  meetings: number;
  opportunities: number;
  reports: number;
};

async function readCounts(clientId: string): Promise<ClientCounts> {
  const [posts, inbounds, meetings, opportunities, reports] = await Promise.all([
    prisma.contentPost.count({ where: { clientId } }),
    prisma.inboundSignal.count({ where: { clientId } }),
    prisma.meeting.count({ where: { clientId } }),
    prisma.opportunity.count({ where: { clientId } }),
    prisma.report.count({ where: { clientId } })
  ]);

  return { posts, inbounds, meetings, opportunities, reports };
}

function assertEqualCounts(before: ClientCounts, after: ClientCounts, context: string): void {
  if (
    before.posts !== after.posts ||
    before.inbounds !== after.inbounds ||
    before.meetings !== after.meetings ||
    before.opportunities !== after.opportunities ||
    before.reports !== after.reports
  ) {
    throw new Error(
      `${context} changed control-client data unexpectedly: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
    );
  }
}

async function main(): Promise<void> {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true }
  });

  if (clients.length < 2) {
    throw new Error("Need at least two clients in DB. Run `npm run db:seed` first.");
  }

  const targetClient = clients[0];
  const controlClient = clients[1];

  const controlBefore = await readCounts(controlClient.id);

  await prisma.$transaction(async (tx) => {
    await clearClientWorkspaceData(tx, targetClient.id);
    await setClientDataMode(tx, targetClient.id, "real");
  });

  const controlAfterClear = await readCounts(controlClient.id);
  assertEqualCounts(controlBefore, controlAfterClear, "Clear workspace");

  await prisma.$transaction(async (tx) => {
    await resetClientToSampleData(tx, targetClient.id);
  });

  const controlAfterReset = await readCounts(controlClient.id);
  assertEqualCounts(controlBefore, controlAfterReset, "Reset sample");

  console.log(
    `Isolation check passed. Control client "${controlClient.name}" remained unchanged during clear/reset of "${targetClient.name}".`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
