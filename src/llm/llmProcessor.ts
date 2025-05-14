import { Message } from "discord.js";
import { OpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { RetrievalQAChain } from "langchain/chains";
import { readFileSync } from "fs";
import path from "path";

// Initialize OpenAI model
const model = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o",
  temperature: 0.7,
});

// Initialize embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Path to store vector database
const VECTOR_STORE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "vectorstore"
);

// Maintain a cache of project-specific vector stores
const vectorStoreCache: Record<string, any> = {};

/**
 * Load or create a vector store for a specific project
 */
const getVectorStore = async (projectName: string): Promise<any> => {
  if (vectorStoreCache[projectName]) {
    return vectorStoreCache[projectName];
  }

  try {
    // Try to load existing vector store
    const vectorStore = await HNSWLib.load(
      path.join(VECTOR_STORE_PATH, projectName),
      embeddings
    );
    vectorStoreCache[projectName] = vectorStore;
    return vectorStore;
  } catch (error) {
    // Create a new vector store if it doesn't exist
    console.log(`Creating new vector store for project: ${projectName}`);

    // Load the project documents
    const projectDataPath = path.join(
      __dirname,
      "..",
      "data",
      "projects",
      projectName
    );
    const docs = await loadProjectDocuments(projectDataPath);

    // Create the vector store
    const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);

    // Save the vector store
    await vectorStore.save(path.join(VECTOR_STORE_PATH, projectName));

    vectorStoreCache[projectName] = vectorStore;
    return vectorStore;
  }
};

/**
 * Load documents from a project directory
 */
const loadProjectDocuments = async (
  projectPath: string
): Promise<Document[]> => {
  try {
    // Read all text files in the project directory
    const files = ["guidelines.txt", "faq.txt", "documentation.txt"];

    const docs: Document[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(path.join(projectPath, file), "utf-8");

        // Split text into chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });

        const splitDocs = await textSplitter.createDocuments(
          [content],
          [{ source: file, project: path.basename(projectPath) }]
        );
        docs.push(...splitDocs);
      } catch (error) {
        console.log(
          `Could not read file ${file} for project ${path.basename(
            projectPath
          )}`
        );
      }
    }

    return docs;
  } catch (error) {
    console.error(
      `Error loading documents for project: ${path.basename(projectPath)}`,
      error
    );
    return [];
  }
};

/**
 * Extract project name from message content
 */
const extractProject = (content: string): string | null => {
  // Try to match patterns like "project X", "regarding project X", etc.
  const projectMatches = content.match(
    /(?:project|regarding|about)\s+([a-zA-Z0-9_-]+)/i
  );

  if (projectMatches && projectMatches[1]) {
    return projectMatches[1].toLowerCase();
  }

  return null;
};

/**
 * Process message content to determine if it's a command or a question
 */
const isCommand = (content: string): boolean => {
  // Check for command-like patterns
  return (
    content.includes("say:") ||
    content.includes("send a message") ||
    content.includes("tell") ||
    content.toLowerCase().includes("notify")
  );
};

/**
 * Process a command from the message
 */
const processCommand = (content: string): string => {
  // Extract the command part (everything after "say:", "tell X", etc.)
  const commandMatch = content.match(
    /(?:say:|tell\s+\w+:|notify\s+\w+:)\s+(.*)/i
  );

  if (commandMatch && commandMatch[1]) {
    return commandMatch[1].trim();
  }

  // If no specific pattern matches, return the original content
  return content;
};

/**
 * Main function to process messages with LLM
 */
export const processMessageWithLLM = async (
  content: string,
  message: Message
): Promise<string> => {
  // Extract project name if present
  const projectName = extractProject(content);
  return new Promise((resolve) => {
    resolve("test");
  });
  // Determine if the message is a command or a question
  // if (isCommand(content)) {
  //   // Process as a command
  //   const commandMessage = processCommand(content);
  //   return `I'll send the following message: "${commandMessage}"`;
  // } else {
  //   // Process as a question using the LLM and vector store
  //   if (projectName) {
  //     try {
  //       // Get the vector store for the project
  //       const vectorStore = await getVectorStore(projectName);

  //       // Create a retrieval chain
  //       const chain = RetrievalQAChain.fromLLM(
  //         model,
  //         vectorStore.asRetriever()
  //       );

  //       // Run the chain
  //       const response = await chain.call({
  //         query: content,
  //       });

  //       return response.text;
  //     } catch (error) {
  //       console.error("Error querying LLM with vector store:", error);
  //       return `I couldn't find specific information about project ${projectName}. Could you provide more details or rephrase your question?`;
  //     }
  //   } else {
  //     // General query without project context
  //     try {
  //       const response = await model.call(
  //         `You are a helpful assistant for a company called SuperAnnotate. Answer the following question as accurately as possible based on your knowledge: ${content}`
  //       );

  //       return response;
  //     } catch (error) {
  //       console.error("Error querying LLM for general question:", error);
  //       return "I'm sorry, I couldn't process your request at the moment. Please try again later.";
  //     }
  //   }
  // }
};
