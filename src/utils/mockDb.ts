// Mock MongoDB implementation
class MockCollection {
  private documents: any[] = [];

  async insertOne(document: any): Promise<{ insertedId: string }> {
    const doc = {
      _id: Math.random().toString(36).substring(7),
      ...document,
    };
    this.documents.push(doc);
    return { insertedId: doc._id };
  }

  async find(query: any = {}): Promise<any[]> {
    return this.documents.filter((doc) => {
      for (const [key, value] of Object.entries(query)) {
        if (key === "technologies") {
          if (
            !doc.technologies.some(
              (tech: string) =>
                tech.toLowerCase() === (value as string).toLowerCase()
            )
          ) {
            return false;
          }
        } else if (
          doc[key]?.toLowerCase() !== (value as string).toLowerCase()
        ) {
          return false;
        }
      }
      return true;
    });
  }

  async findOne(query: any): Promise<any | null> {
    const results = await this.find(query);
    return results[0] || null;
  }

  async updateOne(query: any, update: any): Promise<{ modifiedCount: number }> {
    const doc = await this.findOne(query);
    if (doc) {
      Object.assign(doc, update);
      return { modifiedCount: 1 };
    }
    return { modifiedCount: 0 };
  }

  async deleteOne(query: any): Promise<{ deletedCount: number }> {
    const index = this.documents.findIndex((doc) => {
      for (const [key, value] of Object.entries(query)) {
        if (doc[key] !== value) return false;
      }
      return true;
    });

    if (index !== -1) {
      this.documents.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
}

class MockDb {
  private collections: { [key: string]: MockCollection } = {};

  collection(name: string): MockCollection {
    if (!this.collections[name]) {
      this.collections[name] = new MockCollection();
    }
    return this.collections[name];
  }
}

// Create a singleton instance
const mockDb = new MockDb();

export { mockDb };
