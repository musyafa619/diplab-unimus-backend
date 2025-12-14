import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStudent extends Document {
  name: string;
  nim: string;
  phoneNumber?: string;
  email?: string;
  majorId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema: Schema = new Schema<IStudent>(
  {
    name: { type: String, required: true },
    nim: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String },
    email: { type: String },
    majorId: { type: Schema.Types.ObjectId, ref: 'Major', required: true },
  },
  { timestamps: true }
);

const Student =
  mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);
export default Student;
