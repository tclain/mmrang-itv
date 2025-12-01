"use client";

import FileUpload from "@/components/FileUpload";
import { useCoAgent, useLangGraphInterrupt } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useEffect, useRef } from "react";
import { AgentState } from "../../../../agent/src/agent";

export const useOnce = (fn: () => void) => {
  const doneRef = useRef(false);
  useEffect(() => {
    if (!doneRef.current) {
      fn();
      doneRef.current = true;
    }
  }, []);
};

export function CopilotKit() {
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
            <p>Question: {args.event.value.value}?</p>
            {args.event.value.choices?.map((choice) => (
              <button key={choice} onClick={() => args.resolve(choice)}>
                {choice}
              </button>
            ))}
          </>
        );
      }
      return null;
    },
  });

  // useLangGraphInterrupt({
  //   enabled: (event) => {
  //     return event.eventValue === "__interrupt_required_approval";
  //   },
  //   render: (args) => {
  //     return (
  //       <div>
  //         <button
  //           onClick={() => {
  //             args.resolve("Yes");
  //           }}
  //         >
  //           Yes
  //         </button>
  //         <button
  //           onClick={() => {
  //             args.resolve("No");
  //           }}
  //         >
  //           No
  //         </button>
  //       </div>
  //     );
  //   },
  // });

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
