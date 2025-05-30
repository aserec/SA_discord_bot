import {
  SlashCommandBuilder,
  CommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { mockDb } from "../utils/mockDb";
import { updateQueueMessage } from "../utils/updateQueueMessage";

interface Request {
  project: string;
  technologies: string[];
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

// Get user's approved technologies from roles
const getUserTechnologies = (userTags: string[]): string[] => {
  // This is a mock implementation. In reality, you would parse the user's roles/tags
  // to determine which technologies they are approved for
  return ["Python", "JavaScript", "TypeScript", "React", "Node.js"].filter(
    (tech) => userTags.some((tag) => tag.includes(tech))
  );
};

// Function to save request to mock database
const saveRequest = async (request: any): Promise<boolean> => {
  try {
    await mockDb.collection("requests").insertOne(request);
    return true;
  } catch (error) {
    console.error("Error saving request:", error);
    return false;
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("request-items")
    .setDescription("Request items for a project"),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Get user's roles/tags
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const userTags = member?.roles.cache.map((role) => role.name) || [];

      // Get user's projects and technologies
      const userProjects = getUserProjects(userTags);
      const userTechnologies = getUserTechnologies(userTags);

      if (userProjects.length === 0) {
        return interaction.editReply("You are not part of any projects.");
      }

      if (userTechnologies.length === 0) {
        return interaction.editReply(
          "You don't have any approved technologies."
        );
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

      // Create technology selection menu (multiselect)
      const techSelect = new StringSelectMenuBuilder()
        .setCustomId("tech-select")
        .setPlaceholder("Select technologies")
        .setMinValues(1)
        .setMaxValues(userTechnologies.length)
        .addOptions(
          userTechnologies.map((tech) => ({
            label: tech,
            value: tech,
          }))
        );

      const projectRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          projectSelect
        );
      const techRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          techSelect
        );

      // Send both selection menus
      const response = await interaction.editReply({
        content: "Please select a project and technologies:",
        components: [projectRow, techRow],
      });

      // Create collectors for both dropdowns
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      let selectedProject: string | null = null;
      let selectedTechnologies: string[] = [];
      let isCancelled = false;

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return;

        if (i.customId === "project-select") {
          selectedProject = i.values[0];
        } else if (i.customId === "tech-select") {
          selectedTechnologies = i.values;
        }

        await i.deferUpdate();

        // If both selections are made, show confirmation button
        if (selectedProject && selectedTechnologies.length > 0) {
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

          await interaction.editReply({
            content: `Please confirm your request:\nProject: ${selectedProject}\nTechnologies: ${selectedTechnologies.join(
              ", "
            )}`,
            components: [buttonRow],
          });

          // Create a new collector for the buttons
          const buttonCollector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
          });

          buttonCollector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) return;

            if (i.customId === "confirm-request") {
              await i.deferUpdate();
              buttonCollector.stop();
              collector.stop();
            } else if (i.customId === "cancel-request") {
              isCancelled = true;
              buttonCollector.stop();
              collector.stop();
            }
          });

          buttonCollector.on("end", async (collected) => {
            if (collected.size === 0) {
              await interaction.editReply({
                content: "Request timed out.",
                components: [],
              });
            }
          });
        }
      });

      // Wait for both selections and confirmation
      await new Promise((resolve) => {
        collector.on("end", resolve);
      });

      if (
        !selectedProject ||
        selectedTechnologies.length === 0 ||
        isCancelled
      ) {
        return interaction.editReply({
          content: isCancelled
            ? "Request cancelled."
            : "Selection cancelled or timed out.",
          components: [],
        });
      }

      // Check for existing requests for this project and user
      const existingRequest = await mockDb.collection("requests").findOne({
        project: selectedProject,
        username: interaction.user.tag,
      });

      if (existingRequest) {
        // Find which technologies are new and which already exist
        const existingTechs = existingRequest.technologies;
        const newTechs = selectedTechnologies.filter(
          (tech) => !existingTechs.includes(tech)
        );
        const duplicateTechs = selectedTechnologies.filter((tech) =>
          existingTechs.includes(tech)
        );

        if (newTechs.length > 0) {
          // Update existing request with new technologies
          await mockDb.collection("requests").updateOne(
            {
              project: selectedProject,
              username: interaction.user.tag,
            },
            {
              $set: {
                technologies: [...existingTechs, ...newTechs],
              },
            }
          );

          // Update the queue message
          await updateQueueMessage();

          // Construct response message
          let responseMessage = "Request updated:\n";
          if (duplicateTechs.length > 0) {
            responseMessage += `- Already requested: ${duplicateTechs.join(
              ", "
            )}\n`;
          }
          responseMessage += `- New technologies added: ${newTechs.join(", ")}`;

          return interaction.editReply({
            content: responseMessage,
            components: [],
          });
        } else {
          return interaction.editReply({
            content: `You already have a request for ${selectedProject} with all selected technologies: ${duplicateTechs.join(
              ", "
            )}`,
            components: [],
          });
        }
      }

      // Create new request if no existing request found
      const request: Request = {
        project: selectedProject!,
        technologies: selectedTechnologies,
        username: interaction.user.username,
        userId: interaction.user.id,
        displayName:
          (interaction.member as any)?.nickname || interaction.user.globalName,
        status: "Pending",
        timestamp: new Date(),
      };

      // Save to mock database
      await mockDb.collection("requests").insertOne(request);

      // Update the queue message
      await updateQueueMessage();

      // Send confirmation
      await interaction.editReply({
        content: `Request submitted successfully!\nProject: ${
          request.project
        }\nTechnologies: ${request.technologies.join(", ")}`,
        components: [],
      });
    } catch (error) {
      console.error("Error in request-items command:", error);
      return interaction.editReply({
        content:
          "There was an error submitting your request. Please try again later.",
        components: [],
      });
    }
  },
};
