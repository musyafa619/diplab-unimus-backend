import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBooking extends Document {
  studentId: Types.ObjectId;
  items: Types.ObjectId[];
  start_date: Date;
  end_date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema: Schema = new Schema<IBooking>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    items: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
export default Booking;
