const UserFavoriteSchema = require('../models/UserFavorite');

class UserFavoriteService {
    static async getFavorites(userId) {
        try {
            const favorites = await UserFavoriteSchema.find({ userId }); // Usando `find` em vez de `findOne`
            return favorites; // Retorna [] se não houver favoritos (não gera erro)
        } catch (error) {
            console.error('Erro ao buscar favoritos:', error);
            throw new Error('Erro ao buscar favoritos'); // Mensagem mais genérica
        }
    }
}

module.exports = UserFavoriteService;