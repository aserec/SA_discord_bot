# SuperAnnotate Discord Bot

A Discord bot made in TypeScript that helps manage and consult a custom LLM to answer frequently asked questions, guidelines, and other documents related to different projects.

## Features

- **Ask Questions**: Use the `/ask` command or mention the bot to ask questions about specific projects.
- **Upload Documents**: Upload project-specific documents for the bot to learn from using the `/upload` command.
- **Send Messages**: Send targeted messages to team members regarding specific projects with the `/send` command.
- **Project Management**: List all available projects and their documentation with the `/projects` command.
- **Natural Language Processing**: The bot can understand when you're asking about a specific project or when you're giving a command.

## Setup

1. **Clone the repository**
   ```
   git clone https://github.com/aserec/SA_discord_bot.git
   cd SA_discord_bot
   ```

2. **Install dependencies**
   ```
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following content:
   ```
   # Discord Bot Token
   DISCORD_TOKEN=your_discord_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_GUILD_ID=your_guild_id_here

   # OpenAI API Key
   OPENAI_API_KEY=your_openai_api_key_here

   # Node Environment
   NODE_ENV=development
   ```

4. **Register slash commands**
   ```
   npm run deploy
   ```

5. **Build the bot**
   ```
   npm run build
   ```

6. **Start the bot**
   ```
   npm start
   ```

   For development with hot reloading:
   ```
   npm run dev
   ```

## Usage

### Adding Documents

1. Use the `/upload` command to add a document to a specific project:
   ```
   /upload project:Project-X type:guidelines document:[upload a text file]
   ```

   Document types:
   - `guidelines`: General guidelines for the project
   - `faq`: Frequently asked questions
   - `documentation`: Technical documentation

2. The bot will process and store the document, making it available for future queries.

### Asking Questions

1. You can ask the bot questions in two ways:
   - Using the `/ask` command:
     ```
     /ask question:What are the deadlines for Project-X? project:Project-X
     ```
   
   - Mentioning the bot:
     ```
     @SuperAnnotateBot What are the deadlines for Project-X?
     ```

2. The bot will analyze the question, identify the project context (if provided), and search for relevant information in its knowledge base.

### Sending Messages

Use the `/send` command to send messages to team members:
```
/send user:@JohnDoe project:Project-X message:Your tracked time is overdue. Please review.
```

### Viewing Projects

Use the `/projects` command to list all available projects and their associated documentation.

## Project Structure

```
src/
├── commands/       # Slash commands
├── events/         # Discord event handlers
├── llm/            # LLM integration logic
├── utils/          # Utility functions
├── data/           # Project documents
│   └── projects/   # Project-specific folders
└── index.ts        # Entry point
```

## Development

### Adding New Commands

1. Create a new file in the `src/commands` directory.
2. Export an object with `data` (SlashCommandBuilder) and `execute` (function) properties.
3. Run `npm run deploy` to register the new commands with Discord.
4. The command will be automatically loaded when the bot starts.

### Customizing LLM Integration

The LLM processing logic is located in `src/llm/llmProcessor.ts`. You can modify this file to:
- Change how projects are detected in messages
- Adjust the response generation logic
- Implement additional context processing
- Modify command detection patterns

## License

ISC 