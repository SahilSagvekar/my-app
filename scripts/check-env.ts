
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve('.env');
console.log('Env Path:', envPath);
console.log('Exists:', fs.existsSync(envPath));

const result = dotenv.config();
console.log('Dotenv Results:', result.error ? 'Error' : 'Success');
if (result.error) console.log(result.error);

console.log('DATABASE_URL starts with:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) : 'undefined');

const content = fs.readFileSync(envPath, 'utf8');
console.log('First 50 chars of .env:', content.substring(0, 50));
