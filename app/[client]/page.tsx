import { getClient } from "@/lib/clients";
import { Coldscore } from "@/components/Coldscore";
import { InvalidLink } from "@/components/InvalidLink";

// Looks up the client by slug at request time.
export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: { client: string };
}) {
  const rec = await getClient(params.client);

  if (!rec || rec.status === "disabled") {
    return <InvalidLink />;
  }

  return (
    <Coldscore
      isAdmin={false}
      clientSlug={rec.slug}
      clientName={rec.name}
      initialRemaining={rec.remaining}
    />
  );
}
