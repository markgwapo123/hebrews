import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import { isIP } from 'node:net';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
const email=process.env.OWNER_EMAIL?.trim().toLowerCase();
const password=process.env.OWNER_PASSWORD;
const name=process.env.OWNER_NAME||'Hebrews Owner';
if(!process.env.MONGODB_URI||!email||!password||password.length<12){console.error('Set MONGODB_URI, OWNER_EMAIL and OWNER_PASSWORD (12+ chars) in environment');process.exit(1);}
const configuredDns=process.env.MONGODB_DNS_SERVERS?.split(',').map(s=>s.trim()).filter(Boolean);
dns.setServers(configuredDns?.length && configuredDns.every(s=>isIP(s)) ? configuredDns : ['8.8.8.8','1.1.1.1']);
try{
 await mongoose.connect(process.env.MONGODB_URI,{dbName:process.env.MONGODB_DB_NAME||'hebrews_db',serverSelectionTimeoutMS:12000});
 if(await User.exists({role:'owner'}))throw new Error('Owner already exists. Bootstrap refused.');
 await User.create({name,email,role:'owner',passwordHash:await bcrypt.hash(password,12)});
 console.log('Owner account created');await mongoose.disconnect();
}catch(error){console.error(error.message);process.exitCode=1;await mongoose.disconnect().catch(()=>{});}
