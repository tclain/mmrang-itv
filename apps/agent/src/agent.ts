/**
 * This is the main entry point for the agent.
 * It defines the workflow graph, state, tools, nodes and edges.
 */

import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import {
  Command,
  END,
  interrupt,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";

import {
  convertActionsToDynamicStructuredTools,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";
import { Annotation } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import {
  BaseCheckpointSaver,
  Checkpoint,
} from "@langchain/langgraph-checkpoint";
import { readFileSync, writeFileSync } from "fs";
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

type LearningPlan = {
  topic: string;
  completed: boolean;
}[];

const LearningPlanSchema = z.object({
  learningPlan: z.array(
    z.object({
      topic: z.string(),
      completed: z.boolean(),
    })
  ),
});
// 1. Define our agent state, which includes CopilotKit state to
//    provide actions to the state.
const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec, // CopilotKit state annotation already includes messages, as well as frontend tools
  approved: Annotation<boolean>,
  learningPlan: Annotation<LearningPlan>,
  step: Annotation<string>,
});

// 2. Define the type for our agent state
export type AgentState = typeof AgentStateAnnotation.State;

async function createLearningPlan(state: AgentState) {
  console.info("Entered createLearningPlan");
  if (state.learningPlan) {
    if (state.approved === true) {
      return new Command({
        goto: "handle_topic",
        update: {
          step: "handle_topic",
        },
      });
    }
    return new Command({
      goto: "approval_node",
      update: {
        step: "approval_node",
      },
    });
  }

  const learningPlan = await new ChatOpenAI({
    temperature: 1,
    model: "gpt-5-mini",
    apiKey: process.env.OPEN_AI_KEY,
  })
    .withStructuredOutput(LearningPlanSchema)
    .invoke([
      new SystemMessage(
        `Create a learning plan for the user based on the following topics: HTML. One topic should be completed by 2-3 MCQ`
      ),
      ...state.messages,
    ]);

  return {
    ...state,
    messages: [...state.messages, new AIMessage(`Here is the learning plan.`)],
    learningPlan: learningPlan.learningPlan.map((topic) => ({
      topic: topic.topic,
      completed: false,
    })),
    step: "approval_node",
  };
}

// 5. Define the chat node, which will handle the chat logic
async function approval_node(state: AgentState, config: RunnableConfig) {
  console.info("Entered approval_node 🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠🟠");
  const approved = interrupt(
    "Are you sure you want to approve this Learning Plan?"
  );
  // 5.5 Return the response, which will be added to the state
  return {
    ...state,
    approved: approved.toLowerCase().includes("yes"),
  };
}

async function requiresLearningPlanApproval({ approved }: AgentState) {
  if (!approved) {
    return "approval_node";
  }
  return "handle_topic";
}

async function requireAllTopicsCompleted({ learningPlan }: AgentState) {
  if (learningPlan.every((topic) => topic.completed)) {
    return "review";
  }
  return "handle_topic";
}
// Define the workflow graph
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("create_learning_plan", createLearningPlan)
  .addNode("approval_node", approval_node)
  .addNode("handle_topic", (state) => {
    const nextTopic = state.learningPlan.find((topic) => !topic.completed);
    if (!nextTopic) {
      return state;
    }
    const response = interrupt(`Handle the topic: ${nextTopic.topic}`);

    const isResponseValid = response.toLowerCase().includes("yes");
    return {
      ...state,
      learningPlan: state.learningPlan.map((topic) => {
        return {
          ...topic,
          completed:
            topic.topic === nextTopic.topic ? isResponseValid : topic.completed,
        };
      }),
    };
  })
  .addNode("review", async (state, config) => {
    // 5.4 Invoke the model with the system message and the messages in the state
    const response = await new ChatOpenAI({
      temperature: 1,
      model: "gpt-5-mini",
      apiKey: process.env.OPEN_AI_KEY,
    }).invoke(
      `Review the learning plan and explain to the user what they learn today ${JSON.stringify(
        state.learningPlan
      )}`,
      config
    );

    return {
      ...state,
      messages: [...state.messages, response],
    };
  })
  .addEdge(START, "create_learning_plan")
  .addEdge("create_learning_plan", "approval_node")
  .addEdge("approval_node", "handle_topic")
  .addEdge("review", END)
  .addConditionalEdges("approval_node", requiresLearningPlanApproval)
  .addConditionalEdges("handle_topic", requireAllTopicsCompleted);

const sqliteSaver = SqliteSaver.fromConnString("./agent.db");

export const graph = workflow.compile({
  checkpointer: sqliteSaver,
});
