import mongoose from 'mongoose';

export async function connectDB(uri?: string): Promise<void> {
  const mongoUri = uri || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is not set');
  }

  // mongoose options can be added if needed
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
}
