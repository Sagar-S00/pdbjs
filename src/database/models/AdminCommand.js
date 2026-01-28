import mongoose from 'mongoose';

const adminCommandSchema = new mongoose.Schema({
    commandName: {
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

export const AdminCommand = mongoose.model('AdminCommand', adminCommandSchema);
