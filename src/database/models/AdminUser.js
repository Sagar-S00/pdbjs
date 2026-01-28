import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    addedBy: {
        type: String // userId of who added them
    }
});

export const AdminUser = mongoose.model('AdminUser', adminUserSchema);
