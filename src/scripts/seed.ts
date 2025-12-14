import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import Major from '../models/major';
import Item from '../models/item';
import Student from '../models/student';
import Booking from '../models/booking';

async function main() {
  try {
    await connectDB();

    console.log('Clearing existing data...');
    await Promise.all([
      Major.deleteMany({}),
      Item.deleteMany({}),
      Student.deleteMany({}),
      Booking.deleteMany({}),
    ]);

    console.log('Seeding majors...');
    const majorsData = [
      { name: 'Computer Science' },
      { name: 'Information Systems' },
      { name: 'Electrical Engineering' },
    ];
    const majors = await Major.insertMany(majorsData);

    console.log('Seeding items...');
    const imageUrl =
      'https://res.cloudinary.com/diwyghl1k/image/upload/v1764832078/lvflmweikmojggbgwphf_e_background_removal_f_png_rwwq6x.png';
    const itemsData = [
      { name: 'Projector', quantity: 2, imageUrl },
      { name: 'Laptop', quantity: 5, imageUrl },
      { name: 'Microphone', quantity: 10, imageUrl },
    ];
    // If an old unique index on `id` exists from previous schema versions,
    // inserting docs without `id` can trigger duplicate key errors (multiple nulls).
    // Drop that index if present so seed can proceed.
    try {
      // `indexExists` accepts index name or key spec; legacy name was 'id_1'
      const hasIdIndex = await (Item.collection as any).indexExists('id_1');
      if (hasIdIndex) {
        // eslint-disable-next-line no-console
        console.log('Dropping legacy index `id_1` on items collection');
        // dropIndex will throw if index was removed concurrently, so swallow errors
        await (Item.collection as any).dropIndex('id_1');
      }
    } catch (e) {
      // ignore any errors while dropping the legacy index
    }

    const items = await Item.insertMany(itemsData as any);

    console.log('Seeding students...');
    const studentsData = [
      {
        name: 'Alice Johnson',
        nim: '2025001',
        phoneNumber: '081234567890',
        email: 'alice@example.com',
        majorId: majors[0]._id,
      },
      {
        name: 'Bob Santoso',
        nim: '2025002',
        phoneNumber: '081298765432',
        email: 'bob@example.com',
        majorId: majors[1]._id,
      },
      {
        name: 'Citra Dewi',
        nim: '2025003',
        phoneNumber: '081211122233',
        email: 'citra@example.com',
        majorId: majors[2]._id,
      },
    ];
    const students = await Student.insertMany(studentsData as any);

    console.log('Seeding bookings...');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const bookingsData = [
      {
        studentId: students[0]._id,
        items: [items[0]._id, items[2]._id],
        start_date: now,
        end_date: tomorrow,
      },
      {
        studentId: students[1]._id,
        items: [items[1]._id],
        start_date: now,
        end_date: tomorrow,
      },
    ];
    const bookings = await Booking.insertMany(bookingsData as any);

    console.log('Seed complete:');
    console.log(`  majors: ${majors.length}`);
    console.log(`  items: ${items.length}`);
    console.log(`  students: ${students.length}`);
    console.log(`  bookings: ${bookings.length}`);

    await mongoose.disconnect();
    console.log('Disconnected and finished.');
  } catch (err) {
    console.error('Seed failed', err);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
