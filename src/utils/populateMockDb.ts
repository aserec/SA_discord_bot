import { mockDb } from "./mockDb";

const sampleRequests = [
  {
    project: "Project-A",
    technologies: ["Python", "JavaScript"],
    username: "JohnDoe#1234",
    status: "Pending",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    project: "Project-A",
    technologies: ["TypeScript", "React"],
    username: "JaneSmith#5678",
    status: "Approved",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
  {
    project: "Project-B",
    technologies: ["Node.js", "Python"],
    username: "BobJohnson#9012",
    status: "Pending",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
  },
  {
    project: "Project-C",
    technologies: ["JavaScript", "React", "Node.js"],
    username: "AliceBrown#3456",
    status: "Rejected",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
  {
    project: "Project-B",
    technologies: ["TypeScript"],
    username: "CharlieWilson#7890",
    status: "Pending",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
  },
];

export const populateMockDb = async () => {
  try {
    // Clear existing requests
    const requests = await mockDb.collection("requests").find();
    for (const request of requests) {
      await mockDb.collection("requests").deleteOne({ _id: request._id });
    }

    // Insert sample requests
    for (const request of sampleRequests) {
      await mockDb.collection("requests").insertOne(request);
    }

    console.log("Successfully populated mock database with sample requests");
  } catch (error) {
    console.error("Error populating mock database:", error);
  }
};
