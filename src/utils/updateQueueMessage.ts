import { WebhookClient } from "discord.js";
import { mockDb } from "./mockDb";

interface Request {
  project: string;
  technologies: string[];
  username: string;
  status: string;
  timestamp: Date;
}

// Format timestamp to a more readable format
const formatTimestamp = (date: Date): string => {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Create the queue message content
export const createQueueMessage = (requests: Request[]): string => {
  let content = "**Requests Queue**\n";
  content += `Total Requests: ${requests.length}\n\n`;

  // First group by project
  const projects = requests.reduce((acc, request) => {
    if (!acc[request.project]) {
      acc[request.project] = [];
    }
    acc[request.project].push(request);
    return acc;
  }, {} as Record<string, Request[]>);

  // For each project, group by status and add content
  Object.entries(projects).forEach(([project, projectRequests], index) => {
    // Add project title
    content += `**📋 ${project}**\n`;
    content += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    // Group requests by status within the project
    const statusGroups = projectRequests.reduce((acc, request) => {
      if (!acc[request.status]) {
        acc[request.status] = [];
      }
      acc[request.status].push(request);
      return acc;
    }, {} as Record<string, Request[]>);

    // Add content for each status in the project
    Object.entries(statusGroups).forEach(([status, statusRequests]) => {
      content += `**${status}** (${statusRequests.length})\n`;

      const value = statusRequests
        .map(
          (req) =>
            `• ${req.username.split("#")[0]} - ${req.technologies.join(
              ", "
            )} - ${formatTimestamp(req.timestamp)}`
        )
        .join("\n");

      content += value + "\n\n";
    });

    // Add a divider after each project except the last one
    if (index < Object.keys(projects).length - 1) {
      content += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    }
  });

  return content;
};

export const updateQueueMessage = async () => {
  try {
    // Get the monitor configuration
    const monitor = await mockDb
      .collection("queueMonitor")
      .findOne({ _id: "monitor" });

    if (!monitor) {
      console.log("No queue monitor configured");
      return;
    }

    // Create webhook client
    const webhook = new WebhookClient({
      id: monitor.webhookId,
      token: monitor.webhookToken,
    });

    // Get current requests
    const requests = await mockDb.collection("requests").find();

    // Apply project filter if it exists
    const filteredRequests = monitor.projectFilter
      ? requests.filter((req) =>
          req.project
            .toLowerCase()
            .includes(monitor.projectFilter.toLowerCase())
        )
      : requests;

    // Create and send the updated message
    const content = createQueueMessage(filteredRequests);

    try {
      await webhook.editMessage(monitor.messageId, { content });
    } catch (error) {
      console.error("Error updating webhook message:", error);
      // If the message edit fails, try to send a new message
      try {
        const newMessage = await webhook.send({ content });
        // Update the stored message ID
        await mockDb
          .collection("queueMonitor")
          .updateOne(
            { _id: "monitor" },
            { $set: { messageId: newMessage.id } }
          );
      } catch (sendError) {
        console.error("Error sending new webhook message:", sendError);
      }
    }
  } catch (error) {
    console.error("Error updating queue message:", error);
  }
};
