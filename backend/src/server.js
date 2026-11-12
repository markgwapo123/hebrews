import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import { isIP } from 'node:net';
import { app } from './app.js';
import { startKeepAlive } from './keepAlive.js';

// Use working public DNS resolvers for Atlas SRV lookups.
// An optional MONGODB_DNS_SERVERS override must contain only valid IP addresses.
const configuredDns = process.env.MONGODB_DNS_SERVERS?.split(',').map(s => s.trim()).filter(Boolean);
const dnsServers = configuredDns?.length && configuredDns.every(server => isIP(server))
  ? configuredDns
  : ['8.8.8.8', '1.1.1.1'];
dns.setServers(dnsServers);
const port = Number(process.env.PORT || 5000);
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI: configure it privately in backend/.env or hosting environment variables.');
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Missing or weak JWT_SECRET: configure a random secret with at least 32 characters.');
  process.exit(1);
}
try {
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || 'hebrews_db',
    serverSelectionTimeoutMS: 12000,
    maxPoolSize: 10
  });
  console.log('MongoDB connected to database:', mongoose.connection.name);

  app.listen(port, () => {
    console.log('Hebrews API listening on port', port);
    startKeepAlive();
  });
} catch (error) {
  console.error('MongoDB connection failed:', {
    name: error.name,
    code: error.code,
    message: String(error.message || '').replace(/mongodb(?:\\+srv)?:\\/\\/[^\\s@]+@/g, 'mongodb://[REDACTED]@')
  });
  process.exit(1);
}
