"use client";

import {
  useCoAgent,
  useCoAgentStateRender,
  useLangGraphInterrupt,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

export function CopilotKit() {
  const agentState = useCoAgent({
    name: "starterAgent",
  });
  useLangGraphInterrupt({
    render: (args) => {
      return (
        <div className="flex flex-col gap-2">
          <p>{args.event.value}</p>
          <button
            className="bg-blue-500 text-white p-2 rounded-md"
            onClick={() => {
              args.resolve("Yes");
            }}
          >
            Yes
          </button>
          <button
            style={{
              backgroundColor: "red",
              color: "white",
              padding: "10px",
              borderRadius: "5px",
            }}
            className="bg-red-500 text-white p-2 rounded-md"
            onClick={() => {
              args.resolve("No");
            }}
          >
            No
          </button>
        </div>
      );
    },
  });

  useCoAgentStateRender({
    name: "create_learning_plan",
    nodeName: "create_learning_plan",
    render: (args) => {
      return (
        <div className="flex flex-col gap-2">
          <p>Creating learning plan</p>
          {JSON.stringify(args.state, null, 2)}
        </div>
      );
    },
  });

  return (
    <div className="flex flex-row gap-4">
      <div className="flex-1">
        <pre>{JSON.stringify(agentState, null, 2)}</pre>
      </div>
      <div className="flex-1">
        <CopilotChat
          labels={{
            title: "Popup Assistant",
            initial:
              '👋 Hi, there! You\'re chatting with an agent. This agent comes with a few tools to get you started.\n\nFor example you can try:\n- **Frontend Tools**: "Set the theme to orange"\n- **Shared State**: "Write a proverb about AI"\n- **Generative UI**: "Get the weather in SF"\n\nAs you interact with the agent, you\'ll see the UI update in real-time to reflect the agent\'s **state**, **tool calls**, and **progress**.',
          }}
        />
      </div>
    </div>
  );
}
