import {
  SlashCommandBuilder,
  CommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} from "discord.js";
import { mockDb } from "../utils/mockDb";
import { updateQueueMessage } from "../utils/updateQueueMessage";

interface ReassignmentRequest {
  project: string;
  itemNumber: string;
  username: string;
  userId: string;
  status: string;
  timestamp: Date;
}

// Get user's projects from roles
const getUserProjects = (userTags: string[]): string[] => {
  // This is a mock implementation. In reality, you would parse the user's roles/tags
  // to determine which projects they are part of
  return ["Project-A", "Project-B", "Project-C"].filter((project) =>
    userTags.some((tag) => tag.includes(project))
  );
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("request-reassignment")
    .setDescription("Request reassignment of an item")
    .addStringOption((option) =>
      option
        .setName("item-number")
        .setDescription("The item number to request reassignment for")
        .setRequired(true)
        .setMaxLength(15)
    )
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project name")
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const itemNumber = interaction.options.get("item-number")
        ?.value as string;
      const project = interaction.options.get("project")?.value as string;

      // Get user's roles/tags
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const userTags = member?.roles.cache.map((role) => role.name) || [];

      // Get user's projects
      const userProjects = getUserProjects(userTags);

      if (userProjects.length === 0) {
        return interaction.editReply("You are not part of any projects.");
      }

      // Check if the user has access to the specified project
      if (!userProjects.includes(project)) {
        return interaction.editReply(
          `You don't have access to project "${project}". Available projects: ${userProjects.join(
            ", "
          )}`
        );
      }

      // Check for existing reassignment request for this item
      const existingRequest = await mockDb
        .collection("reassignmentRequests")
        .findOne({
          project: project,
          itemNumber: itemNumber,
          username: interaction.user.tag,
        });

      if (existingRequest) {
        return interaction.editReply({
          content: `You already have a reassignment request for item ${itemNumber} in project ${project}.`,
          components: [],
        });
      }

      // Show confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId("confirm-request")
        .setLabel("Confirm Request")
        .setStyle(ButtonStyle.Primary);

      const cancelButton = new ButtonBuilder()
        .setCustomId("cancel-request")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton,
        cancelButton
      );

      const response = await interaction.editReply({
        content: `Please confirm your reassignment request:\nProject: ${project}\nItem Number: ${itemNumber}`,
        components: [buttonRow],
      });

      // Create a collector for the buttons
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return;

        if (i.customId === "confirm-request") {
          await i.deferUpdate();

          // Create new reassignment request
          const request: ReassignmentRequest = {
            project: project,
            itemNumber: itemNumber,
            username: interaction.user.tag,
            userId: interaction.user.id,
            status: "Pending",
            timestamp: new Date(),
          };

          // Save to mock database
          await mockDb.collection("reassignmentRequests").insertOne(request);

          // Update the queue message
          await updateQueueMessage();

          // Send confirmation
          await interaction.editReply({
            content: `Reassignment request submitted successfully!\nProject: ${request.project}\nItem Number: ${request.itemNumber}`,
            components: [],
          });
        } else if (i.customId === "cancel-request") {
          await i.editReply({
            content: "Request cancelled.",
            components: [],
          });
        }

        collector.stop();
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          await interaction.editReply({
            content: "Request timed out.",
            components: [],
          });
        }
      });
    } catch (error) {
      console.error("Error in request-reassignment command:", error);
      return interaction.editReply({
        content:
          "There was an error submitting your reassignment request. Please try again later.",
        components: [],
      });
    }
  },
};
