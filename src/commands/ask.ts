import { SlashCommandBuilder, CommandInteraction } from "discord.js";
import { processMessageWithLLM } from "../llm/llmProcessor";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask the LLM a question")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("The question to ask")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project name (optional)")
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      const question = interaction.options.get("question")?.value as string;
      const project = interaction.options.get("project")?.value as
        | string
        | undefined;

      let finalQuestion = question;
      if (project) {
        finalQuestion = `regarding project ${project}, ${question}`;
      }

      const response = await processMessageWithLLM(
        finalQuestion,
        interaction as any
      );

      return interaction.editReply(response);
    } catch (error) {
      console.error("Error processing question:", error);
      return interaction.editReply(
        "There was an error processing your question. Please try again later."
      );
    }
  },
};
