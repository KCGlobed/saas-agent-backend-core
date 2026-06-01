const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Configuration from .env or fallback
const GCC_BASE_URL = process.env.GCC_BASE_URL || "https://gccwebsite-admin-backend-738131651355.asia-south1.run.app";
const GCC_TOKEN_FALLBACK = process.env.GCC_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc5MzQ4NjA3LCJpYXQiOjE3NzY3NTY2MDcsImp0aSI6IjM2NDRmYjgwZjczMjQxZTFhZWQ3NmUyZjUyNTU1ZGM1IiwidXNlcl9pZCI6IjIzOSJ9.JOOXQRrHrllDbVl5YS9aFghIfiOqahNVi0mJ7Rho-Pw";
const COLLECTION_PATH = path.join(__dirname, "../../collection.json");

const mongoose = require("mongoose");
const Project = require("./models/Project");
const { decrypt } = require("./utils/crypto");

let dbConnected = false;
async function connectDb() {
  if (dbConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    dbConnected = true;
  } catch (err) {
    console.error("MCP: Failed to connect to MongoDB", err.message);
  }
}

async function getActiveToken() {
  await connectDb();
  if (!dbConnected) {
    return GCC_TOKEN_FALLBACK;
  }
  try {
    const project = await Project.findOne().sort({ updatedAt: -1 });
    if (project?.config?.apiCustomToken) {
      return decrypt(project.config.apiCustomToken);
    }
  } catch (err) {
    console.error("MCP: Failed to fetch dynamic token from database", err.message);
  }
  return GCC_TOKEN_FALLBACK;
}

// Parse Postman Collection
const collection = JSON.parse(fs.readFileSync(COLLECTION_PATH, "utf8"));

/**
 * Replaces Postman variables in strings
 */
function resolveVariables(text, token) {
  if (typeof text !== "string") return text;
  return text
    .replace(/{{GCC_Base_url}}/g, GCC_BASE_URL)
    .replace(/{{GCC_Base}}/g, GCC_BASE_URL)
    .replace(/{{token}}/g, token)
    .replace(/{{GCC_Token}}/g, token);
}

/**
 * Recursively extracts requests from Postman folders
 */
function extractRequests(items, tools = []) {
  items.forEach((item) => {
    if (item.request) {
      const name = item.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      let description = `API Call: ${item.name}.`;
      
      // AI-Friendly descriptions
      if (name.includes("studentdata")) description += " Returns list of registered students. Use this to count total students or see registration details.";
      if (name.includes("query")) description += " Returns student inquiries and leads.";
      
      tools.push({
        name: name,
        description: description,
        request: item.request,
        originalName: item.name
      });
    } else if (item.item) {
      extractRequests(item.item, tools);
    }
  });
  return tools;
}

const apiTools = extractRequests(collection.item);

/**
 * Initialize MCP Server
 */
const server = new Server(
  {
    name: "sass-agentic-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Register Tool List
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ...apiTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: "object",
          properties: {
            params: { type: "object", description: "Query parameters" },
            body: { type: "object", description: "Request body" },
          },
        },
      })),
      // Add a dedicated shortcut tool
      {
        name: "get_total_students_today",
        description: "Special tool to get the count of students registered today.",
        inputSchema: { type: "object", properties: {} }
      }
    ],
  };
});

/**
 * Register Tool Execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const activeToken = await getActiveToken();

  if (request.params.name === "get_total_students_today") {
    // Implement shortcut logic
    const tool = apiTools.find(t => t.name.includes("studentdata"));
    if (!tool) throw new Error("Student data tool not found");
    
    const url = resolveVariables(tool.request.url.raw, activeToken).split('?')[0]; // Base URL
    const response = await axios.get(url, {
      headers: { "Authorization": `Bearer ${activeToken}` }
    });
    
    const students = response.data?.data || response.data || [];
    const count = Array.isArray(students) ? students.length : "unknown";
    
    return {
      content: [{ type: "text", text: `There are currently ${count} students in the system.` }]
    };
  }

  const tool = apiTools.find((t) => t.name === request.params.name);
  if (!tool) throw new Error(`Tool ${request.params.name} not found`);

  const { params = {}, body = {} } = request.params.arguments || {};
  const req = tool.request;

  let url = resolveVariables(req.url.raw || "", activeToken);
  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) => urlObj.searchParams.set(key, value));
  url = urlObj.toString();

  try {
    const response = await axios({
      method: req.method,
      url: url,
      data: body,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${activeToken}`
      },
    });

    return {
      content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
