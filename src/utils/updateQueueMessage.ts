import {
  WebhookClient,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { mockDb } from "./mockDb";

interface Request {
  _id: string;
  project: string;
  technologies: string[];
  username: string;
  userId: string;
  status: string;
  timestamp: Date;
}

interface ReassignmentRequest {
  _id: string;
  project: string;
  itemNumber: string;
  username: string;
  userId: string;
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

// Create the queue message content
export const createQueueMessage = async (
  requests: Request[],
  reassignmentRequests: ReassignmentRequest[]
): Promise<{
  content: string;
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
}> => {
  let content = "**Requests Queue**\n";
  content += `Total Requests: ${
    requests.length + reassignmentRequests.length
  }\n\n`;

  const components: ActionRowBuilder<
    ButtonBuilder | StringSelectMenuBuilder
  >[] = [];

  // First group by project
  const projects = requests.reduce((acc, request) => {
    if (!acc[request.project]) {
      acc[request.project] = [];
    }
    acc[request.project].push(request);
    return acc;
  }, {} as Record<string, Request[]>);

  // Group reassignment requests by project
  const reassignmentProjects = reassignmentRequests.reduce((acc, request) => {
    if (!acc[request.project]) {
      acc[request.project] = [];
    }
    acc[request.project].push(request);
    return acc;
  }, {} as Record<string, ReassignmentRequest[]>);

  // Combine all project names
  const allProjects = new Set([
    ...Object.keys(projects),
    ...Object.keys(reassignmentProjects),
  ]);

  // Create a map to store request IDs
  const requestIdMap = new Map<string, number>();
  let currentId = 1;

  // For each project, group by status and add content
  Array.from(allProjects).forEach((project, index) => {
    // Add project title
    content += `**📋 ${project}**\n`;
    content += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    // Handle regular requests
    if (projects[project]) {
      // Group requests by status within the project
      const statusGroups = projects[project].reduce((acc, request) => {
        if (!acc[request.status]) {
          acc[request.status] = [];
        }
        acc[request.status].push(request);
        return acc;
      }, {} as Record<string, Request[]>);

      // Add content for each status in the project
      Object.entries(statusGroups).forEach(([status, statusRequests]) => {
        content += `**${status}** (${statusRequests.length})\n`;

        statusRequests.forEach((req) => {
          // Ensure request has an _id
          if (!req._id) {
            req._id = Math.random().toString(36).substr(2, 9);
            // Update the request in the database
            mockDb
              .collection("requests")
              .updateOne(
                { username: req.username, project: req.project },
                { $set: { _id: req._id } }
              );
          }
          requestIdMap.set(req._id, currentId);
          content += `[${currentId}] ${
            req.username.split("#")[0]
          } - ${req.technologies.join(", ")} - ${formatTimestamp(
            req.timestamp
          )}\n`;
          currentId++;
        });

        content += "\n";
      });
    }

    // Handle reassignment requests
    if (reassignmentProjects[project]) {
      // Group reassignment requests by status within the project
      const statusGroups = reassignmentProjects[project].reduce(
        (acc, request) => {
          if (!acc[request.status]) {
            acc[request.status] = [];
          }
          acc[request.status].push(request);
          return acc;
        },
        {} as Record<string, ReassignmentRequest[]>
      );

      // Add content for each status in the project
      Object.entries(statusGroups).forEach(([status, statusRequests]) => {
        content += `**${status} Reassignment Requests** (${statusRequests.length})\n`;

        statusRequests.forEach((req) => {
          // Ensure request has an _id
          if (!req._id) {
            req._id = Math.random().toString(36).substr(2, 9);
            // Update the request in the database
            mockDb.collection("reassignmentRequests").updateOne(
              {
                username: req.username,
                project: req.project,
                itemNumber: req.itemNumber,
              },
              { $set: { _id: req._id } }
            );
          }
          requestIdMap.set(req._id, currentId);
          content += `[${currentId}] ${req.username.split("#")[0]} - Item ${
            req.itemNumber
          } - ${formatTimestamp(req.timestamp)}\n`;
          currentId++;
        });

        content += "\n";
      });
    }

    // Add a divider after each project except the last one
    if (index < Array.from(allProjects).length - 1) {
      content += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    }
  });

  // Create select menu with all requests
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("request-select")
    .setPlaceholder("Search and select a request to manage")
    .setMinValues(1)
    .setMaxValues(1);

  // Add regular requests to select menu
  requests.forEach((req) => {
    const requestId = requestIdMap.get(req._id);
    console.log("Regular request mapping:", { _id: req._id, requestId });
    selectMenu.addOptions({
      label: `[${requestId}] ${req.username.split("#")[0]} - ${req.project}`,
      description: `${req.technologies.join(", ")} - ${req.status}`,
      value: `regular_${req._id}_${req.username}_${req.project}`,
    });
  });

  // Add reassignment requests to select menu
  reassignmentRequests.forEach((req) => {
    const requestId = requestIdMap.get(req._id);
    console.log("Reassignment request mapping:", { _id: req._id, requestId });
    selectMenu.addOptions({
      label: `[${requestId}] ${req.username.split("#")[0]} - ${
        req.project
      } (Reassignment)`,
      description: `Item ${req.itemNumber} - ${req.status}`,
      value: `reassignment_${req._id}_${req.username}_${req.project}_${req.itemNumber}`,
    });
  });

  // Create action buttons
  const completeButton = new ButtonBuilder()
    .setCustomId("complete-request")
    .setLabel("Complete")
    .setStyle(ButtonStyle.Success)
    .setDisabled(true);

  const rejectButton = new ButtonBuilder()
    .setCustomId("reject-request")
    .setLabel("Reject")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(true);

  const deleteButton = new ButtonBuilder()
    .setCustomId("delete-request")
    .setLabel("Delete")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  // Add components to message
  components.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      completeButton,
      rejectButton,
      deleteButton
    )
  );

  return { content, components };
};

// Update the queue message
export const updateQueueMessage = async () => {
  try {
    // Get the queue monitor configuration
    const monitor = await mockDb.collection("queueMonitor").findOne({
      _id: "monitor",
    });

    if (!monitor) {
      console.log("No queue monitor configuration found");
      return;
    }

    // Get all requests
    const requests = await mockDb.collection("requests").find();
    const reassignmentRequests = await mockDb
      .collection("reassignmentRequests")
      .find();

    // Apply project filter if specified
    const filteredRequests = monitor.projectFilter
      ? requests.filter((req) =>
          req.project
            .toLowerCase()
            .includes(monitor.projectFilter.toLowerCase())
        )
      : requests;
    const filteredReassignmentRequests = monitor.projectFilter
      ? reassignmentRequests.filter((req) =>
          req.project
            .toLowerCase()
            .includes(monitor.projectFilter.toLowerCase())
        )
      : reassignmentRequests;

    // Create the message content
    const { content, components } = await createQueueMessage(
      filteredRequests,
      monitor.showReassignmentRequests ? filteredReassignmentRequests : []
    );

    // Create webhook client
    const webhook = new WebhookClient({
      id: monitor.webhookId,
      token: monitor.webhookToken,
    });

    // Update the message
    await webhook.editMessage(monitor.messageId, {
      content,
      components,
    });
  } catch (error) {
    console.error("Error updating queue message:", error);
  }
};

// Handle button interactions
export const handleQueueButtonInteraction = async (interaction: any) => {
  try {
    if (interaction.isStringSelectMenu()) {
      // Get the selected value
      const selectedValue = interaction.values[0];

      // Create a new select menu with the selected option marked as default
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("request-select")
        .setPlaceholder("Search and select a request to manage")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          interaction.message.components[0].components[0].options.map(
            (opt: any) => ({
              ...opt,
              default: opt.value === selectedValue,
            })
          )
        );

      // Enable buttons when a request is selected
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("complete-request")
          .setLabel("Complete")
          .setStyle(ButtonStyle.Success)
          .setDisabled(false),
        new ButtonBuilder()
          .setCustomId("reject-request")
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(false),
        new ButtonBuilder()
          .setCustomId("delete-request")
          .setLabel("Delete")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(false)
      );

      // Update the message with enabled buttons and selected option
      await interaction.update({
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            selectMenu
          ),
          row,
        ],
      });
      return;
    }

    if (interaction.isButton()) {
      const selectedRequest =
        interaction.message.components[0].components[0].options.find(
          (opt: any) => opt.default
        )?.value;

      console.log("Selected request value:", selectedRequest);

      if (!selectedRequest) {
        await interaction.reply({
          content: "Please select a request first.",
          ephemeral: true,
        });
        return;
      }

      const [type, requestId, username, project, ...rest] =
        selectedRequest.split("_");
      console.log("Parsed values:", {
        type,
        requestId,
        username,
        project,
        rest,
      });

      // Disable buttons after action
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("complete-request")
          .setLabel("Complete")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("reject-request")
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("delete-request")
          .setLabel("Delete")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      if (type === "reassignment") {
        console.log("Looking for reassignment request with ID:", requestId);
        const request = await mockDb
          .collection("reassignmentRequests")
          .findOne({
            _id: requestId,
          });

        console.log("Found request:", request);
        if (!request) {
          await interaction.reply({
            content: "Reassignment request not found.",
            ephemeral: true,
          });
          return;
        }

        switch (interaction.customId) {
          case "complete-request":
            console.log("Completing reassignment request:", requestId);
            // Update request status
            await mockDb
              .collection("reassignmentRequests")
              .updateOne({ _id: requestId }, { $set: { status: "Approved" } });

            // Send DM to user
            const user = await interaction.client.users.fetch(request.userId);
            await user.send(
              `✅ Your reassignment request for item ${request.itemNumber} in project ${request.project} has been approved.`
            );
            break;

          case "reject-request":
            // Update request status
            await mockDb
              .collection("reassignmentRequests")
              .updateOne({ _id: requestId }, { $set: { status: "Rejected" } });

            // Send DM to user
            const user2 = await interaction.client.users.fetch(request.userId);
            await user2.send(
              `❌ Your reassignment request for item ${request.itemNumber} in project ${request.project} has been rejected by ${interaction.user.tag}. Please contact this person if you are doubtful of why your request was rejected.`
            );
            break;

          case "delete-request":
            // Delete the request
            await mockDb
              .collection("reassignmentRequests")
              .deleteOne({ _id: requestId });
            break;
        }
      } else {
        const request = await mockDb.collection("requests").findOne({
          _id: requestId,
        });

        if (!request) {
          await interaction.reply({
            content: "Request not found.",
            ephemeral: true,
          });
          return;
        }

        switch (interaction.customId) {
          case "complete-request":
            // Update request status
            await mockDb
              .collection("requests")
              .updateOne({ _id: requestId }, { $set: { status: "Approved" } });

            // Send DM to user
            const user = await interaction.client.users.fetch(request.userId);
            await user.send(
              `✅ Your request for ${
                request.project
              } in technologies ${request.technologies.join(
                ", "
              )} have been processed. Please check the platform, you should have one or more item/s assigned.`
            );
            break;

          case "reject-request":
            // Update request status
            await mockDb
              .collection("requests")
              .updateOne({ _id: requestId }, { $set: { status: "Rejected" } });

            // Send DM to user
            const user2 = await interaction.client.users.fetch(request.userId);
            await user2.send(
              `❌ Your request has been rejected by ${interaction.user.tag}. Please contact this person if you are doubtful of why your request was rejected.`
            );
            break;

          case "delete-request":
            // Delete the request
            await mockDb.collection("requests").deleteOne({ _id: requestId });
            break;
        }
      }

      // Update the queue message
      await updateQueueMessage();

      // Acknowledge the interaction and disable buttons
      await interaction.update({
        components: [interaction.message.components[0], row],
      });
    }
  } catch (error) {
    console.error("Error handling button interaction:", error);
    await interaction.reply({
      content:
        "There was an error processing your action. Please try again later.",
      ephemeral: true,
    });
  }
};
