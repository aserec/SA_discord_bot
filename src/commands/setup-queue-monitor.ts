import {
  SlashCommandBuilder,
  CommandInteraction,
  TextChannel,
  WebhookClient,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";
import { mockDb } from "../utils/mockDb";

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

// Example data for initial setup
const exampleRequests: Request[] = [
  {
    project: "Project-A",
    technologies: ["Python", "JavaScript"],
    username: "JohnDoe#1234",
    status: "Pending",
    timestamp: new Date("2024-01-15T14:30:00"),
  },
  {
    project: "Project-B",
    technologies: ["Node.js", "Python"],
    username: "BobJohnson#5678",
    status: "Pending",
    timestamp: new Date("2024-01-15T12:00:00"),
  },
  {
    project: "Project-B",
    technologies: ["TypeScript"],
    username: "CharlieWilson#9012",
    status: "Pending",
    timestamp: new Date("2024-01-15T06:00:00"),
  },
  {
    project: "Project-A",
    technologies: ["TypeScript", "React"],
    username: "JaneSmith#3456",
    status: "Approved",
    timestamp: new Date("2024-01-14T14:30:00"),
  },
  {
    project: "Project-C",
    technologies: ["JavaScript", "React", "Node.js"],
    username: "AliceBrown#7890",
    status: "Rejected",
    timestamp: new Date("2024-01-13T14:30:00"),
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-queue-monitor")
    .setDescription("Set up a channel to monitor the requests queue")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to monitor the queue in")
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const channelOption = interaction.options.get("channel");
      if (!channelOption || !channelOption.channel) {
        return interaction.editReply("Please select a valid text channel.");
      }

      const channel = channelOption.channel as TextChannel;

      // Check if the bot has necessary permissions
      const botMember = interaction.guild?.members.cache.get(
        interaction.client.user?.id!
      );
      if (!botMember) {
        return interaction.editReply("Could not find bot member in the guild.");
      }

      const requiredPermissions = [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageWebhooks,
      ];

      const missingPermissions = requiredPermissions.filter(
        (permission) => !botMember.permissionsIn(channel).has(permission)
      );

      if (missingPermissions.length > 0) {
        const permissionNames = missingPermissions.map((p) =>
          p.toString().replace(/_/g, " ").toLowerCase()
        );
        return interaction.editReply(
          `I don't have the required permissions in ${channel}. Please make sure I have the following permissions:\n` +
            `• ${permissionNames.join("\n• ")}\n\n` +
            `You can fix this by:\n` +
            `1. Going to Server Settings > Roles > @SA-magic-bot\n` +
            `2. Enabling the required permissions\n` +
            `3. Making sure the bot's role is above the channel's permission overwrites`
        );
      }

      // Create a webhook for the channel
      const webhook = await channel.createWebhook({
        name: "Queue Monitor",
        avatar: interaction.client.user?.displayAvatarURL(),
      });

      // Insert example data if the requests collection is empty
      const existingRequests = await mockDb.collection("requests").find();
      if (existingRequests.length === 0) {
        for (const request of exampleRequests) {
          await mockDb.collection("requests").insertOne(request);
        }
      }

      // Get current requests
      const requests = await mockDb.collection("requests").find();

      // Create and send the initial embed
      const embed = createQueueEmbed(requests);
      const message = await webhook.send({ embeds: [embed] });

      // Store the webhook and message IDs in the database
      await mockDb.collection("queueMonitor").updateOne(
        { _id: "monitor" },
        {
          $set: {
            webhookId: webhook.id,
            webhookToken: webhook.token,
            messageId: message.id,
            channelId: channel.id,
          },
        },
        { upsert: true }
      );

      return interaction.editReply(
        `Queue monitor has been set up in ${channel}. The message will be automatically updated when requests change.`
      );
    } catch (error) {
      console.error("Error setting up queue monitor:", error);
      return interaction.editReply(
        "There was an error setting up the queue monitor. Please make sure I have the necessary permissions to create webhooks in the selected channel."
      );
    }
  },
};
