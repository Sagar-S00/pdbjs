import { connectDatabase } from '../database/connect.js';
import { addAdmin, loadAdminCache } from '../utils/adminUtils.js';

async function main() {
    const userId = process.argv[2];
    if (!userId) {
        console.error('Usage: node src/scripts/setAdmin.js <userId>');
        process.exit(1);
    }

    try {
        await connectDatabase();
        await loadAdminCache();

        console.log(`Adding user ${userId} as admin...`);
        const success = await addAdmin(userId, 'SYSTEM');

        if (success) {
            console.log(`✅ User ${userId} successfully added as admin.`);
        } else {
            console.log(`⚠️ User ${userId} is already an admin.`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error adding admin:', error);
        process.exit(1);
    }
}

main();
