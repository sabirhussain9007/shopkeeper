import mongoose from "mongoose";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseConnection?: CachedConnection;
};

const cached = globalWithMongoose.mongooseConnection ?? { conn: null, promise: null };
globalWithMongoose.mongooseConnection = cached;

export async function connectDb() {
  const uri = process.env.MONGODB_URI ?? "";
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  if (cached.conn) return cached.conn;
  cached.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
  });
  cached.conn = await cached.promise;
  return cached.conn;
}
