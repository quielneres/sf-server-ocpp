const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    // user: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'User',
    //     required: true
    // },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID é obrigatório']
    },


    // userId: { type: String, required: true },

    cep: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^\d{5}-\d{3}$/.test(v);
            },
            message: props => `${props.value} não é um CEP válido!`
        }
    },
    state: {
        type: String,
        required: true,
        uppercase: true,
        minlength: 2,
        maxlength: 2
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    neighborhood: {
        type: String,
        required: true,
        trim: true
    },
    street: {
        type: String,
        required: true,
        trim: true
    },
    number: {
        type: String,
        required: true,
        trim: true
    },
    complement: {
        type: String,
        trim: true
    },
    isPrimary: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

// Garante que só haja um endereço primário por usuário
addressSchema.pre('save', async function(next) {
    if (this.isPrimary) {
        await this.constructor.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { $set: { isPrimary: false } }
        );
    }
    next();
});

module.exports = mongoose.model('Address', addressSchema);