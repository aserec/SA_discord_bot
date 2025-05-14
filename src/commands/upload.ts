import {
  SlashCommandBuilder,
  CommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import fs from "fs";
import path from "path";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upload")
    .setDescription("Upload a document for the LLM to learn from")
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project name this document belongs to")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of document")
        .setRequired(true)
        .addChoices(
          { name: "Guidelines", value: "guidelines" },
          { name: "FAQ", value: "faq" },
          { name: "Documentation", value: "documentation" }
        )
    )
    .addAttachmentOption((option) =>
      option
        .setName("document")
        .setDescription("The document file to upload (text format)")
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      const projectName = interaction.options.get("project")?.value as string;
      const docType = interaction.options.get("type")?.value as string;
      const attachment = interaction.options.get("document")?.attachment;

      if (!attachment) {
        return interaction.editReply("No attachment was provided.");
      }

      if (!attachment.contentType?.includes("text")) {
        return interaction.editReply("Please upload a text file.");
      }

      // Fetch the attachment content
      const response = await fetch(attachment.url);
      if (!response.ok) {
        return interaction.editReply("Failed to fetch the attachment.");
      }

      const content = await response.text();

      // Create project directory if it doesn't exist
      const projectDir = path.join(
        __dirname,
        "..",
        "data",
        "projects",
        projectName
      );
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      // Save the file
      const filePath = path.join(projectDir, `${docType}.txt`);
      fs.writeFileSync(filePath, content);

      return interaction.editReply(
        `Successfully uploaded ${docType} for project ${projectName}. The bot will now be able to answer questions about this document.`
      );
    } catch (error) {
      console.error("Error uploading document:", error);
      return interaction.editReply(
        "There was an error uploading the document. Please try again later."
      );
    }
  },
};
