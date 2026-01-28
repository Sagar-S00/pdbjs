import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const URI = "mongodb+srv://raku:raku1234@cluster0.7dhk4es.mongodb.net/?retryWrites=true&w=majority";
const OPTIONS = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
};

export async function connectDatabase() {
    try {
        await mongoose.connect(URI, OPTIONS);
        logger.success('Connected to MongoDB');
    } catch (error) {
        logger.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}
