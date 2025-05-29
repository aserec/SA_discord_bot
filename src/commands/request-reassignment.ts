import {
  SlashCommandBuilder,
  CommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from "discord.js";
import { mockDb } from "../utils/mockDb";
import { updateQueueMessage } from "../utils/updateQueueMessage";

interface ReassignmentRequest {
  project: string;
  itemNumber: string;
  username: string;
  userId: string;
  displayName: string;
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
    .setDescription("Request reassignment of an item"),

  async execute(interaction: CommandInteraction) {
    try {
      // Get user's roles/tags
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const userTags = member?.roles.cache.map((role) => role.name) || [];

      // Get user's projects
      const userProjects = getUserProjects(userTags);

      if (userProjects.length === 0) {
        return interaction.reply({
          content: "You are not part of any projects.",
          ephemeral: true,
        });
      }

      // Create project selection menu
      const projectSelect = new StringSelectMenuBuilder()
        .setCustomId("project-select")
        .setPlaceholder("Select a project")
        .addOptions(
          userProjects.map((project) => ({
            label: project,
            value: project,
          }))
        );

      const projectRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          projectSelect
        );

      // Send project selection menu
      const response = await interaction.reply({
        content: "Please select a project:",
        components: [projectRow],
        ephemeral: true,
      });

      // Create collector for project selection
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      let selectedProject: string | null = null;

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return;

        selectedProject = i.values[0];

        // Create modal for item number input
        const modal = new ModalBuilder()
          .setCustomId("item-number-modal")
          .setTitle("Enter Item Number");

        const itemNumberInput = new TextInputBuilder()
          .setCustomId("item-number")
          .setLabel("Item Number")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Enter the item number")
          .setRequired(true)
          .setMaxLength(15);

        const itemNumberRow =
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            itemNumberInput
          );

        modal.addComponents(itemNumberRow);

        await i.showModal(modal);
        collector.stop();
      });

      // Wait for project selection
      await new Promise((resolve) => {
        collector.on("end", resolve);
      });

      if (!selectedProject) {
        return interaction.editReply({
          content: "Selection cancelled or timed out.",
          components: [],
        });
      }

      // Wait for modal submission
      try {
        const modalSubmit = await interaction.awaitModalSubmit({
          time: 60000,
          filter: (i) =>
            i.customId === "item-number-modal" &&
            i.user.id === interaction.user.id,
        });

        const itemNumber = modalSubmit.fields.getTextInputValue("item-number");

        // Check for existing reassignment request for this item
        const existingRequest = await mockDb
          .collection("reassignmentRequests")
          .findOne({
            project: selectedProject,
            itemNumber: itemNumber,
            username: interaction.user.username,
          });

        if (existingRequest) {
          return modalSubmit.reply({
            content: `You already have a reassignment request for item ${itemNumber} in project ${selectedProject}.`,
            ephemeral: true,
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

        await modalSubmit.reply({
          content: `Please confirm your reassignment request:\nProject: ${selectedProject}\nItem Number: ${itemNumber}`,
          components: [buttonRow],
          ephemeral: true,
        });

        // Create a collector for the buttons
        const buttonCollector = (
          await modalSubmit.fetchReply()
        ).createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60000,
        });

        let isCancelled = false;

        buttonCollector.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) return;

          if (i.customId === "confirm-request") {
            await i.deferUpdate();

            // Create new reassignment request
            const request: ReassignmentRequest = {
              project: selectedProject!,
              itemNumber: itemNumber,
              username: interaction.user.username,
              userId: interaction.user.id,
              displayName:
                (interaction.member as any)?.nickname ||
                interaction.user.globalName,
              status: "Pending",
              timestamp: new Date(),
            };

            // Save to mock database
            await mockDb.collection("reassignmentRequests").insertOne(request);

            // Update the queue message
            await updateQueueMessage();

            // Send confirmation
            await i.editReply({
              content: `Reassignment request submitted successfully!\nProject: ${request.project}\nItem Number: ${request.itemNumber}`,
              components: [],
            });
          } else if (i.customId === "cancel-request") {
            isCancelled = true;
            await i.update({
              content: "Request cancelled.",
              components: [],
            });
          }

          buttonCollector.stop();
        });

        buttonCollector.on("end", async (collected) => {
          if (collected.size === 0 && !isCancelled) {
            await modalSubmit.editReply({
              content: "Request timed out.",
              components: [],
            });
          }
        });
      } catch (error) {
        return interaction.editReply({
          content: "Item number input timed out.",
          components: [],
        });
      }
    } catch (error) {
      console.error("Error in request-reassignment command:", error);
      return interaction.reply({
        content:
          "There was an error submitting your reassignment request. Please try again later.",
        ephemeral: true,
      });
    }
  },
};
