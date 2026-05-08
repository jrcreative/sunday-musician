import { Topbar } from "@/components/shell/Topbar";
import { NewRequestForm } from "./NewRequestForm";

export default function NewRequestPage() {
  return (
    <>
      <Topbar title="New request" crumbs={[{ label: "Requests", href: "/requests" }, { label: "New" }]} />
      <NewRequestForm />
    </>
  );
}
