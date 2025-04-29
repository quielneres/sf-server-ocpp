const mongoose = require('mongoose');

const favoritesSchema = new mongoose.Schema({
    chargerId: { type: String, required: true },
});

const UserFavoriteSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    favorites: [favoritesSchema]
});

module.exports = mongoose.model('UserFavorite', UserFavoriteSchema);