import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app.js';
const port = Number(process.env.PORT || 5000);
if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI in backend/.env'); process.exit(1); }
try {
  await mongoose.connect(process.env.MONGODB_URI);
  app.listen(port, () => console.log(`Hebrews API listening on ${port}`));
} catch (error) {
  console.error('Database connection failed:', error.message);
  process.exit(1);
}
