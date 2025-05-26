class MockDb {
  private collections: Map<string, any[]>;

  constructor() {
    this.collections = new Map();
    // Initialize required collections
    this.collections.set("requests", []);
    this.collections.set("queueMonitor", []);
    this.collections.set("lastSelections", []);
  }

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    return {
      find: () => this.collections.get(name) || [],
      findOne: async (query: any) => {
        const collection = this.collections.get(name) || [];
        return collection.find((item) =>
          Object.entries(query).every(([key, value]) => item[key] === value)
        );
      },
      insertOne: async (doc: any) => {
        const collection = this.collections.get(name) || [];
        collection.push(doc);
        return {
          insertedId: doc._id || Math.random().toString(36).substr(2, 9),
        };
      },
      updateOne: async (query: any, update: any, options?: any) => {
        const collection = this.collections.get(name) || [];
        const index = collection.findIndex((item) =>
          Object.entries(query).every(([key, value]) => item[key] === value)
        );

        if (index === -1 && options?.upsert) {
          const newDoc = { ...query, ...update.$set };
          collection.push(newDoc);
          return { modifiedCount: 1 };
        }

        if (index !== -1) {
          collection[index] = { ...collection[index], ...update.$set };
          return { modifiedCount: 1 };
        }

        return { modifiedCount: 0 };
      },
      deleteOne: async (query: any) => {
        const collection = this.collections.get(name) || [];
        const index = collection.findIndex((item) =>
          Object.entries(query).every(([key, value]) => item[key] === value)
        );

        if (index !== -1) {
          collection.splice(index, 1);
          return { deletedCount: 1 };
        }

        return { deletedCount: 0 };
      },
    };
  }
}

export const mockDb = new MockDb();
