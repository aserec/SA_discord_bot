import { Events, Message } from "discord.js";
import { processMessageWithLLM } from "../llm/llmProcessor";

module.exports = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message is a direct mention of the bot
    const botMention = `<@${message.client.user!.id}>`;
    const isMentioned = message.content.includes(botMention);

    // Process messages that mention the bot or are DMs
    if (isMentioned || message.channel.isDMBased()) {
      try {
        // Remove the bot mention from the message
        const cleanContent = message.content.replace(botMention, "").trim();

        // Process the message with the LLM
        const response = await processMessageWithLLM(cleanContent, message);

        // Send the response
        await message.reply(response);
      } catch (error) {
        console.error("Error processing message with LLM:", error);
        await message.reply(
          "Sorry, I encountered an error while processing your request."
        );
      }
    }
  },
};
