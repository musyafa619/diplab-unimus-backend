import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
