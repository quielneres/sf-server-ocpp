const mongoose = require('mongoose');

const UserTransactionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    idTag: {
        type: String,
        required: true,
        index: true
    },
    targetKwh: {
        type: Number,
        min: 0
    },
    consumedKwh: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Completed', 'Cancelled'],
        default: 'Active'
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    amountCharged: {
        type: Number,
        default: 0
    },
    chargerId: {
        type: String
    }
}, {
    timestamps: true
});

UserTransactionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('UserTransaction', UserTransactionSchema);