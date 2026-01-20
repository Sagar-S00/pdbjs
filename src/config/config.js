import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config from JSON file in src directory (one level up from src/config/)
const configPath = path.join(__dirname, '..', 'config.json');
let configData = {};

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  configData = JSON.parse(configFile);
} catch (error) {
  console.warn(`Warning: Could not load config.json: ${error.message}. Using defaults.`);
  configData = {};
}

export const config = {
  // Custom Bot Configuration
  bot: {
    name: configData.bot?.name || 'CustomBot',
    id: configData.bot?.id || 'bot-user',
  },

  // PDB API Configuration
  pdb: {
    email: configData.pdb?.email || '',
    accessToken: configData.pdb?.accessToken || '',
    refreshToken: configData.pdb?.refreshToken || '',
    expireAt: configData.pdb?.expireAt || null,
    baseUrl: configData.pdb?.baseUrl || 'https://api.personality-database.com/api/v2',
    deviceToken: configData.pdb?.deviceToken || 'eyJPUyI6ImFuZHJvaWQiLCJBcHAtVmVyc2lvbiI6IjEuNS40IiwiQXBwLUJ1aWxkTm8iOiI3NzQiLCJNYXJrZXQiOiJHb29nbGVQbGF5IiwiQnJhbmQiOiJhc3VzIiwiTW9kZWwiOiJBU1VTX1gwMFREIiwiQnVuZGxlSUQiOiJtYnRpLnRlc3QubWVudGFsLmhlYWx0aC5wZXJzb25hbGl0eSIsIk1hbnVmYWN0dXJlciI6ImFzdXMiLCJPUy1WZXJzaW9uIjoiOSIsIlNESy1WZXJzaW9uIjoiMjgiLCJYLVBEQi1EZXZpY2UtSUQiOiI2YWU4YmM4MS1hNzdlLTRiZjEtYTEzMC1hYTc4NTQ1NGQwMzEifQ==',
    region: configData.pdb?.region || 'IN',
    locale: configData.pdb?.locale || 'en',
    timezone: configData.pdb?.timezone || 'Asia/Kolkata',
  },

  // Stream.io Configuration
  stream: {
    baseUrl: configData.stream?.baseUrl || 'https://chat.stream-io-api.com',
  },


};

/**
 * Save config to JSON file
 */
export function saveConfig(newConfig) {
  try {
    const updatedConfig = {
      bot: {
        name: newConfig.bot?.name || config.bot.name,
        id: newConfig.bot?.id || config.bot.id,
      },
      pdb: {
        email: newConfig.pdb?.email || config.pdb.email,
        accessToken: newConfig.pdb?.accessToken || config.pdb.accessToken,
        refreshToken: newConfig.pdb?.refreshToken || config.pdb.refreshToken,
        expireAt: newConfig.pdb?.expireAt || config.pdb.expireAt,
        baseUrl: newConfig.pdb?.baseUrl || config.pdb.baseUrl,
        deviceToken: newConfig.pdb?.deviceToken || config.pdb.deviceToken,
        region: newConfig.pdb?.region || config.pdb.region,
        locale: newConfig.pdb?.locale || config.pdb.locale,
        timezone: newConfig.pdb?.timezone || config.pdb.timezone,
      },
      stream: {
        baseUrl: newConfig.stream?.baseUrl || config.stream.baseUrl,
      },

    };

    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8');

    // Update in-memory config
    Object.assign(config, updatedConfig);

    return true;
  } catch (error) {
    console.error(`Error saving config: ${error.message}`);
    return false;
  }
}

