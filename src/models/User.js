const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'O nome é obrigatório'],
        trim: true
    },
    cpf: {
        type: String,
        required: [true, 'O CPF é obrigatório'],
        unique: true, // Mantenha apenas aqui ou apenas no schema.index()
        validate: {
            validator: function(v) {
                return /^\d{11}$/.test(v.replace(/\D/g, ''));
            },
            message: props => `${props.value} não é um CPF válido!`
        }
    },
    email: {
        type: String,
        required: [true, 'O email é obrigatório'],
        unique: true, // Mantenha apenas aqui ou apenas no schema.index()
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} não é um email válido!`
        }
    },
    password: {
        type: String,
        required: [true, 'A senha é obrigatória'],
        minlength: [6, 'A senha deve ter pelo menos 6 caracteres']
    },
    phone_ddd: {
        type: String,
        required: [true, 'O DDD é obrigatório'],
        validate: {
            validator: function(v) {
                // Lista de DDDs válidos no Brasil
                const validDDDs = [
                    '11', '12', '13', '14', '15', '16', '17', '18', '19',
                    '21', '22', '24', '27', '28', '31', '32', '33', '34',
                    '35', '37', '38', '41', '42', '43', '44', '45', '46',
                    '47', '48', '49', '51', '53', '54', '55', '61', '62',
                    '63', '64', '65', '66', '67', '68', '69', '71', '73',
                    '74', '75', '77', '79', '81', '82', '83', '84', '85',
                    '86', '87', '88', '89', '91', '92', '93', '94', '95',
                    '96', '97', '98', '99'
                ];
                return validDDDs.includes(v);
            },
            message: props => `${props.value} não é um DDD válido!`
        }
    },
    phone_number: {
        type: String,
        required: [true, 'O número de telefone é obrigatório'],
        validate: {
            validator: function(v) {
                return /^\d{8,9}$/.test(v.replace(/\D/g, ''));
            },
            message: props => `${props.value} não é um número de telefone válido!`
        }
    },
    termsAccepted: {
        type: Boolean,
        default: false,
        validate: {
            validator: function(v) {
                return v === true;
            },
            message: () => 'Você deve aceitar os termos de uso'
        }
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            // Cria um campo virtual com o telefone completo
            ret.phone = `(${ret.phone_ddd}) ${ret.phone_number}`;
            delete ret.password; // Remove a senha do retorno
            return ret;
        }
    },
    toObject: {
        virtuals: true
    }
});

// Virtual para o telefone completo
userSchema.virtual('phone').get(function() {
    return `(${this.phone_ddd}) ${this.phone_number}`;
});

// Índices para melhor performance
// userSchema.index({ email: 1 }, { unique: true });
// userSchema.index({ cpf: 1 });
// userSchema.index({ phone_ddd: 1 });

module.exports = mongoose.model('User', userSchema);