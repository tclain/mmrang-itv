import { CopilotKit } from "@copilotkit/react-core";
import { CopilotKit as CopilotKitClient } from "./client";

export default async function CopilotKitPage(props: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await props.params;
  return (
    <CopilotKit
      threadId={id}
      runtimeUrl="/single-agent/api"
      agent="single-agent"
    >
      <CopilotKitClient />
    </CopilotKit>
  );
}
