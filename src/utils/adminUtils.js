import { AdminUser } from '../database/models/AdminUser.js';
import { AdminCommand } from '../database/models/AdminCommand.js';

let adminCache = new Set();
let adminCommandCache = new Set();
let isCacheLoaded = false;

export async function loadAdminCache() {
    try {
        const users = await AdminUser.find({});
        const commands = await AdminCommand.find({});

        adminCache = new Set(users.map(u => u.userId));
        adminCommandCache = new Set(commands.map(c => c.commandName.toLowerCase()));
        isCacheLoaded = true;
    } catch (error) {
        console.error("Failed to load admin cache:", error);
    }
}

export async function isAdmin(userId) {
    if (!isCacheLoaded) await loadAdminCache();
    return adminCache.has(userId);
}

export async function isCommandAdminOnly(commandName) {
    if (!isCacheLoaded) await loadAdminCache();
    return adminCommandCache.has(commandName.toLowerCase());
}

export async function addAdmin(userId, addedBy) {
    if (adminCache.has(userId)) return false;
    await AdminUser.create({ userId, addedBy });
    adminCache.add(userId);
    return true;
}

export async function removeAdmin(userId) {
    if (!adminCache.has(userId)) return false;
    await AdminUser.deleteOne({ userId });
    adminCache.delete(userId);
    return true;
}

export async function addAdminCommand(commandName, addedBy) {
    const normalizeCmd = commandName.toLowerCase();
    if (adminCommandCache.has(normalizeCmd)) return false;
    await AdminCommand.create({ commandName: normalizeCmd, addedBy });
    adminCommandCache.add(normalizeCmd);
    return true;
}

export async function removeAdminCommand(commandName) {
    const normalizeCmd = commandName.toLowerCase();
    if (!adminCommandCache.has(normalizeCmd)) return false;
    await AdminCommand.deleteOne({ commandName: normalizeCmd });
    adminCommandCache.delete(normalizeCmd);
    return true;
}
