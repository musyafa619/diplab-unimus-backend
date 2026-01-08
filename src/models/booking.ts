import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBooking extends Document {
  studentId: Types.ObjectId;
  items: Array<{ id: Types.ObjectId; quantity: number }>;
  note: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'finished';
}

const BookingSchema: Schema = new Schema<IBooking>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'finished'],
      default: 'pending',
    },
    items: [
      {
        _id: false,
        id: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
        quantity: { type: Number, required: true, default: 1 },
      },
    ],
    startDate: { type: Date, required: true },
    note: { type: String, required: false, default: null },
    endDate: { type: Date, required: true },
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
export default Booking;
