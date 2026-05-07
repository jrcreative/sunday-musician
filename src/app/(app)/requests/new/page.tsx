import { Topbar } from "@/components/shell/Topbar";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ musician?: string }>;
}) {
  const { musician } = await searchParams;
  return (
    <>
      <Topbar title="New request" crumbs={[{ label: "Requests", href: "/requests" }, { label: "New" }]} />
      <NewRequestForm prefilledMusician={musician} />
    </>
  );
}
