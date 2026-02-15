const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1 },
});

async function connectDB() {
  await client.connect();
  console.log("✅ Connected to MongoDB");
}

connectDB();

module.exports = { client };
