import { WebhookClient, EmbedBuilder } from "discord.js";
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

// Create the queue message embed
const createQueueEmbed = (requests: Request[]): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("Requests Queue")
    .setDescription(`Total Requests: ${requests.length}`)
    .setTimestamp();

  // Group requests by status
  const groupedRequests = requests.reduce((acc, request) => {
    if (!acc[request.status]) {
      acc[request.status] = [];
    }
    acc[request.status].push(request);
    return acc;
  }, {} as Record<string, Request[]>);

  // Add fields for each status
  Object.entries(groupedRequests).forEach(([status, statusRequests]) => {
    const value = statusRequests
      .map(
        (req) =>
          `• ${req.username.split("#")[0]} - ${
            req.project
          } (${req.technologies.join(", ")}) - ${formatTimestamp(
            req.timestamp
          )}\n  [Message User](https://discord.com/users/${
            req.username.split("#")[0]
          })`
      )
      .join("\n");

    embed.addFields({
      name: `${status} (${statusRequests.length})`,
      value: value || "No requests",
    });
  });

  return embed;
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

    // Create and send the updated embed
    const embed = createQueueEmbed(requests);

    try {
      await webhook.editMessage(monitor.messageId, { embeds: [embed] });
    } catch (error) {
      console.error("Error updating webhook message:", error);
      // If the message edit fails, try to send a new message
      try {
        const newMessage = await webhook.send({ embeds: [embed] });
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
