"use client";

import FileUpload from "@/components/FileUpload";
import {
  useCoAgent,
  useCopilotChat,
  useFrontendTool,
  useLangGraphInterrupt,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";

import type { AgentState } from "../../../../agent/src/agent-interrupt";
import { useEffect } from "react";

export function CopilotKit() {
  const chat = useCopilotChat();
  const agentState = useCoAgent<AgentState>({
    name: "starterAgent",

  });

  useLangGraphInterrupt({
    render: (args) => {
      console.log(args.event);
      if (args.event.value === "__interrupt_required_resource_uri") {
        return (
          <>
            <p>Start by uploading the PDF file to ingest</p>
            <FileUpload
              onUploaded={(data) => {
                args.resolve(data.url);
              }}
            />
          </>
        );
      }
      if (args.event.value === "__interrupt_required_approval") {
        return (
          <>
            <p>Do you approve of the learning plan?</p>
            <button onClick={() => args.resolve("Yes")}>Yes</button>
            <button onClick={() => args.resolve("No")}>No</button>
          </>
        );
      }

      if (args.event.value.type === "__interrupt_required_topic_completion") {
        return (
          <>
            <p>{args.event.value.value}?</p>
            {args.event.value.choices?.map((choice: string) => (
              <button key={choice} onClick={() => args.resolve(choice)}>
                {choice}
              </button>
            ))}
          </>
        );
      }
      return "";
    },
  });

  useEffect(() => {
    if (!agentState.state.messages?.length) {
      chat.appendMessage(
        new TextMessage({
          role: MessageRole.System,
          content: "Start the workflow",
        })
      );
    }
  }, [agentState.state.messages]);

  useFrontendTool({
    name: "ingest_pdf",
    description: "Ingest a PDF file",
    handler() {
      agentState.sendCommand(new Command({
    },
  });

  useEffect(() => {
    if (agentState.state.copilotkit?.actions) {
      console.log(agentState.state.copilotkit.actions);
    }
  }, [agentState.state.copilotkit?.actions]);

  return (
    <div className="flex flex-row gap-4">
      <div className="flex-1 overflow-x-scroll">
        {agentState.state.learningPlan?.length > 0 ? (
          <div>
            <p>Learning Plan</p>

            {agentState.state.learningPlan.map((topic) => (
              <li
                key={topic.topic}
                className="flex items-stretch gap-1 space-x-1"
              >
                <input
                  type="checkbox"
                  key={topic.topic}
                  checked={topic.completed}
                  className="pt-1"
                />
                {topic.topic}
              </li>
            ))}
          </div>
        ) : (
          <div>
            <p>No learning plan found. Upload a PDF file to get started.</p>
          </div>
        )}
      </div>
      <div className="flex-2">
        <CopilotChat
          labels={{
            title: "Learning Assistant",
            initial:
              "Hi! I am Boomrang, your learning assistant. I' help you learn new things.",
          }}
        />
      </div>
    </div>
  );
}
