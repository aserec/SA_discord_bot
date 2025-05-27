import {
  SlashCommandBuilder,
  CommandInteraction,
  TextChannel,
  WebhookClient,
  PermissionsBitField,
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
    technologies: ["TypeScript", "React"],
    username: "sarah.coder#5678",
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
  {
    project: "Project-A",
    technologies: ["Docker", "Kubernetes"],
    username: "lisa.devops#3456",
    status: "Rejected",
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
  {
    project: "Project-B",
    technologies: ["PostgreSQL", "Redis"],
    username: "david.dba#6789",
    status: "Rejected",
    timestamp: new Date(),
  },

  // Project-C requests
  {
    project: "Project-C",
    technologies: ["React Native", "Firebase"],
    username: "anna.mobile#0123",
    status: "Pending",
    timestamp: new Date(),
  },
  {
    project: "Project-C",
    technologies: ["AWS", "Lambda"],
    username: "tom.cloud#4567",
    status: "Approved",
    timestamp: new Date(),
  },
  {
    project: "Project-C",
    technologies: ["GraphQL", "Apollo"],
    username: "rachel.api#8901",
    status: "Pending",
    timestamp: new Date(),
  },

  // Project-D requests
  {
    project: "Project-D",
    technologies: ["Vue.js", "Vuetify"],
    username: "peter.ui#2345",
    status: "Pending",
    timestamp: new Date(),
  },
  {
    project: "Project-D",
    technologies: ["Go", "gRPC"],
    username: "sophie.backend#6789",
    status: "Approved",
    timestamp: new Date(),
  },
  {
    project: "Project-D",
    technologies: ["Elasticsearch", "Kibana"],
    username: "chris.search#0123",
    status: "Rejected",
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

      // Get current requests
      const requests = await mockDb.collection("requests").find();

      // Apply project filter if specified
      const projectFilter = interaction.options.get("project-filter")?.value as
        | string
        | undefined;
      const filteredRequests = projectFilter
        ? requests.filter((req) =>
            req.project.toLowerCase().includes(projectFilter.toLowerCase())
          )
        : requests;

      // Create and send the initial message
      const content = createQueueMessage(filteredRequests);
      const message = await webhook.send({ content });

      // Store the webhook and message IDs in the database
      await mockDb.collection("queueMonitor").updateOne(
        { _id: "monitor" },
        {
          $set: {
            webhookId: webhook.id,
            webhookToken: webhook.token,
            messageId: message.id,
            channelId: channel.id,
            projectFilter: projectFilter || null,
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
