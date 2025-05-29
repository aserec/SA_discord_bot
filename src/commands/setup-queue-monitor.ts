import {
  SlashCommandBuilder,
  CommandInteraction,
  TextChannel,
  WebhookClient,
  PermissionsBitField,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { mockDb } from "../utils/mockDb";
import { createQueueMessage } from "../utils/updateQueueMessage";

interface Request {
  project: string;
  technologies: string[];
  username: string;
  status: string;
  timestamp: Date;
}

interface ReassignmentRequest {
  project: string;
  itemNumber: string;
  username: string;
  userId: string;
  status: string;
  timestamp: Date;
}

// Example requests for testing
const exampleRequests: Request[] = [
  // Project-A requests
  {
    project: "Project-A",
    technologies: ["Python", "JavaScript"],
    username: "alex.dev#1234",
    status: "Pending",
    timestamp: new Date(),
  },
  {
    project: "Project-A",
    technologies: ["Node.js", "MongoDB"],
    username: "mike.tech#9012",
    status: "Approved",
    timestamp: new Date(),
  },

  // Project-B requests
  {
    project: "Project-B",
    technologies: ["Java", "Spring Boot"],
    username: "john.backend#7890",
    status: "Pending",
    timestamp: new Date(),
  },
  {
    project: "Project-B",
    technologies: ["Angular", "TypeScript"],
    username: "emma.frontend#2345",
    status: "Approved",
    timestamp: new Date(),
  },
];

// Example reassignment requests for testing
const exampleReassignmentRequests: ReassignmentRequest[] = [
  {
    project: "Project-A",
    itemNumber: "12345",
    username: "alex.dev#1234",
    userId: "123456789012345678", // Example user ID
    status: "Pending",
    timestamp: new Date(),
  },
  {
    project: "Project-B",
    itemNumber: "67890",
    username: "sarah.coder#5678",
    userId: "876543210987654321", // Example user ID
    status: "Approved",
    timestamp: new Date(),
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-queue-monitor")
    .setDescription("Set up the requests queue monitor in a channel")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to set up the queue monitor in")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("project-filter")
        .setDescription("Optional: Filter requests by project name (contains)")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("show-reassignment-requests")
        .setDescription(
          "Whether to show reassignment requests in the queue (default: true)"
        )
        .setRequired(false)
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

      // Get all webhooks in the channel
      const webhooks = await channel.fetchWebhooks();

      // Delete all existing webhooks in the channel
      await Promise.all(webhooks.map((webhook) => webhook.delete()));

      // Create a new webhook
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

      // Insert example reassignment requests if the collection is empty
      const existingReassignmentRequests = await mockDb
        .collection("reassignmentRequests")
        .find();
      if (existingReassignmentRequests.length === 0) {
        for (const request of exampleReassignmentRequests) {
          await mockDb.collection("reassignmentRequests").insertOne(request);
        }
      }

      // Get current requests
      const requests = await mockDb.collection("requests").find();
      const reassignmentRequests = await mockDb
        .collection("reassignmentRequests")
        .find();

      // Apply project filter if specified
      const projectFilter = interaction.options.get("project-filter")?.value as
        | string
        | undefined;
      const filteredRequests = projectFilter
        ? requests.filter((req) =>
            req.project.toLowerCase().includes(projectFilter.toLowerCase())
          )
        : requests;
      const filteredReassignmentRequests = projectFilter
        ? reassignmentRequests.filter((req) =>
            req.project.toLowerCase().includes(projectFilter.toLowerCase())
          )
        : reassignmentRequests;

      // Get showReassignmentRequests option (default to true if not specified)
      const showReassignmentRequests =
        (interaction.options.get("show-reassignment-requests")
          ?.value as boolean) ?? true;

      // Create the message content
      const { content, components } = await createQueueMessage(
        filteredRequests,
        showReassignmentRequests ? filteredReassignmentRequests : []
      );

      // Send the message
      const message = await webhook.send({
        content,
        components,
      });

      // Store the webhook and message IDs in the database
      await mockDb.collection("queueMonitor").insertOne({
        _id: "monitor",
        channelId: channel.id,
        webhookId: webhook.id,
        webhookToken: webhook.token,
        messageId: message.id,
        projectFilter: projectFilter,
        showReassignmentRequests: showReassignmentRequests,
      });

      await interaction.editReply(
        "Queue monitor has been set up successfully!"
      );
    } catch (error) {
      console.error("Error setting up queue monitor:", error);
      return interaction.editReply(
        "There was an error setting up the queue monitor. Please make sure I have the necessary permissions to create webhooks in the selected channel."
      );
    }
  },
};
