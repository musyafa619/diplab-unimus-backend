import mongoose, { Document, Schema } from 'mongoose';
import { getNextSequence } from './counter';

export interface IItem extends Document {
  id: number; // numeric id used in UI/business logic
  name: string;
  quantity: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema: Schema = new Schema<IItem>(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

// Auto-increment numeric `id` field for new items
ItemSchema.pre('save', async function (this: any, next: any) {
  if (this.isNew && (this.id === undefined || this.id === null)) {
    try {
      const seq = await getNextSequence('itemid');
      this.id = seq;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

const Item = mongoose.models.Item || mongoose.model<IItem>('Item', ItemSchema);
export default Item;
