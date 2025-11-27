import mongoose, { Document, Schema } from 'mongoose';

export interface IAdmin extends Document {
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema: Schema = new Schema<IAdmin>(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const Admin =
  mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);
export default Admin;
