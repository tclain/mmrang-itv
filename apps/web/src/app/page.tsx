import { redirect } from "next/navigation";

export default function Root() {
  const id = crypto.randomUUID();
  return redirect(`/single-agent/${id}`);
}
