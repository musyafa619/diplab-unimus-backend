import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter extends Document {
  _id: string;
  seq: number;
}

const CounterSchema: Schema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const updated = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).exec();
  return updated.seq;
}
