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
import { readFile, readFileSync, writeFileSync } from "fs";
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { join } from "path";

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
  resourceUrl: Annotation<string | null>,
  resourceContent: Annotation<string | null>,
  approved: Annotation<boolean>,
  learningPlan: Annotation<LearningPlan>,
  step: Annotation<string>,
});

export type AgentState = typeof AgentStateAnnotation.State;

function handlToolsOrNext(successNode: string) {
  return function ({ messages, copilotkit }: AgentState) {
    // 6.1 Get the last message from the state
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // 7.2 If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      // Actions are the frontend tools coming from CopilotKit
      const actions = copilotkit?.actions;
      const toolCallName = lastMessage.tool_calls![0].name;
      return "__end__";
    }
    return successNode;
  };
}

async function askToIngestPdf(state: AgentState) {
  if (state.resourceContent) {
    return new Command({
      goto: "create_learning_plan",
      update: {
        resourceContent: state.resourceContent,
      },
    });
  }

  const modelWithTools = new ChatOpenAI({
    temperature: 1,
    model: "gpt-5-mini",
    apiKey: process.env.OPEN_AI_KEY,
  })
    .bindTools([
      ...convertActionsToDynamicStructuredTools(
        state.copilotkit?.actions ?? []
      ),
    ])
    .invoke([
      new SystemMessage(`You are a document processing assistant.
        Call the ingest_pdf tool to get the URI of the pdf file to work on.`),
      ...state.messages,
    ]);
}

async function extractContentFromUri(state: AgentState) {
  const contentUri = state.resourceUrl;
  if (!contentUri) {
    return state;
  }

  const resolvedPath = join(process.cwd(), contentUri);
  const readContent = new PDFParse({
    data: readFileSync(resolvedPath),
    CanvasFactory,
  });
  const content = (await readContent.getText()).pages
    .map((page) => page.text)
    .join("\n");
  return {
    ...state,
    resourceUrl: contentUri,
    resourceContent: content,
  };
}

async function createLearningPlan(state: AgentState) {
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
        `Create a learning plan for the user based on the following resource: ${state.resourceContent}. One topic should be completed by 2-3 MCQ.
        Target 3 to 5 learning topics.`
      ),
      ...state.messages,
    ]);

  return {
    ...state,
    messages: [
      ...state.messages,
      new AIMessage(`I have updated the learning plan.`),
    ],
    learningPlan: learningPlan.learningPlan.map((topic) => ({
      topic: topic.topic,
      completed: false,
    })),
    step: "approval_node",
  };
}

// 5. Define the chat node, which will handle the chat logic
async function approval_node(state: AgentState, config: RunnableConfig) {
  const approved = interrupt("__interrupt_required_approval");
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

export async function handleTopic(state: AgentState, config: RunnableConfig) {
  console.log(state.learningPlan);
  const nextTopic = state.learningPlan.find((topic) => !topic.completed);
  if (!nextTopic) {
    return state;
  }

  const response = await new ChatOpenAI({
    temperature: 1,
    model: "gpt-5-mini",
    apiKey: process.env.OPEN_AI_KEY,
  })
    .withStructuredOutput(
      z.object({
        question: z.string(),
        choices: z.array(z.string()),
        correctChoice: z.string(),
      })
    )
    .invoke([
      new SystemMessage(
        `Create a question and choices for the user to answer about the topic: ${nextTopic.topic} & source material: ${state.resourceContent}`
      ),
      ...state.messages,
    ]);

  const userResponse = interrupt({
    type: "__interrupt_required_topic_completion",
    value: response.question,
    choices: response.choices,
  });

  const isResponseValid = response.correctChoice === userResponse;
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
}

export async function review(state: AgentState, config: RunnableConfig) {
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
}
// Define the workflow graph
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("ingestPdf", askToIngestPdf)
  .addNode("extractContentFromUri", extractContentFromUri)
  .addNode("create_learning_plan", createLearningPlan)
  .addEdge("extractContentFromUri", "create_learning_plan")
  .addConditionalEdges("create_learning_plan", requiresLearningPlanApproval)
  .addConditionalEdges("ingestPdf", handlToolsOrNext("extractContentFromUri"));

// .addNode("create_learning_plan", createLearningPlan)
// .addNode("approval_node", approval_node)
// .addNode("handle_topic", handleTopic)
// .addNode("review", async (state, config) => {})
// .addEdge(START, "ingestPdf")
// .addEdge("ingestPdf", "create_learning_plan")
// .addEdge("create_learning_plan", "approval_node")
// .addEdge("approval_node", "handle_topic")
// .addEdge("review", END)
// .addConditionalEdges("approval_node", requiresLearningPlanApproval)
// .addConditionalEdges("handle_topic", requireAllTopicsCompleted);

const sqliteSaver = SqliteSaver.fromConnString("./agent.db");

export const graph = workflow.compile({
  checkpointer: sqliteSaver,
});
