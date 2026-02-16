import { getClients } from "@/lib/analytics";
import { getDateRangeFromPreset, type DateRangePreset } from "@/lib/date";
import { parseDateRange } from "@/lib/params";

export async function getDashboardContext(searchParams?: Record<string, string | string[] | undefined>): Promise<{
  clients: Array<{ id: string; name: string }>;
  clientId: string;
  range: DateRangePreset;
  startDate: Date;
  endDate: Date;
}> {
  const clients = await getClients();
  const clientIdRaw = searchParams?.clientId;
  const clientIdValue = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  const fallbackClient = clients[0]?.id;

  if (!fallbackClient) {
    throw new Error("No clients found. Run `npm run db:seed` first.");
  }

  const clientId = clientIdValue && clients.some((client) => client.id === clientIdValue) ? clientIdValue : fallbackClient;

  const rangeRaw = searchParams?.range;
  const rangeValue = Array.isArray(rangeRaw) ? rangeRaw[0] : rangeRaw;
  const range = parseDateRange(rangeValue);
  const { startDate, endDate } = getDateRangeFromPreset(range);

  return {
    clients: clients.map((client) => ({ id: client.id, name: client.name })),
    clientId,
    range,
    startDate,
    endDate
  };
}
