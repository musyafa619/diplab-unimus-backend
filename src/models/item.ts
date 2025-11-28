import mongoose, { Document, Schema } from 'mongoose';

export interface IItem extends Document {
  name: string;
  quantity: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema: Schema = new Schema<IItem>(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

const Item = mongoose.models.Item || mongoose.model<IItem>('Item', ItemSchema);
export default Item;
