import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'Application', 'api', '.env'),
  resolve(__dirname, '..', '..', '.env'),
];

for (const envPath of candidates) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}
