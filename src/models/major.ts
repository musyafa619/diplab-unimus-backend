import mongoose, { Document, Schema } from 'mongoose';

export interface IMajor extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const MajorSchema: Schema = new Schema<IMajor>(
  {
    name: { type: String, required: true },
  },
  { timestamps: true }
);

const Major =
  mongoose.models.Major || mongoose.model<IMajor>('Major', MajorSchema);
export default Major;
