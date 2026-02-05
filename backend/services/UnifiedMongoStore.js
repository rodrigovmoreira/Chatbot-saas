const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');

class UnifiedMongoStore {
    constructor({ mongoose }) {
        if (!mongoose) throw new Error('A valid Mongoose instance is required.');
        this.mongoose = mongoose;
        this.bucketName = 'wwebsessions';
    }

    async sessionExists(options) {
        const cleanId = path.basename(options.session);
        const db = this.mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
        
        // CORREÇÃO 1: countDocuments em vez de count (remove o warning)
        const cursor = bucket.find({ filename: cleanId });
        // O driver novo do Mongo usa hasNext ou toArray para verificar existência de forma eficiente
        const docs = await cursor.limit(1).toArray();
        return docs.length > 0;
    }

    async save(options) {
        const cleanId = path.basename(options.session);
        const db = this.mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: this.bucketName });

        // Apaga anterior
        await this.delete(options);

        const filePath = `${options.session}.zip`;

        // Verifica se o arquivo realmente existe antes de tentar ler
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ [UnifiedMongoStore] Arquivo não encontrado para salvar: ${filePath}`);
            return;
        }

        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(bucket.openUploadStream(cleanId))
                .on('error', reject)
                .on('finish', resolve);
        });
    }

    async extract(options) {
        const cleanId = path.basename(options.session);
        const db = this.mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
        
        const filePath = `${options.session}.zip`;
        const dirPath = path.dirname(filePath);

        // CORREÇÃO 2 (A MAIS IMPORTANTE): Cria a pasta se ela não existir
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            bucket.openDownloadStreamByName(cleanId)
                .pipe(fs.createWriteStream(filePath))
                .on('error', (err) => {
                    // Se o erro for "File not found" no GridFS, rejeita limpo
                    if (err.code === 'ENOENT') {
                        console.warn(`⚠️ [UnifiedMongoStore] Sessão não encontrada no GridFS: ${cleanId}`);
                        resolve(); // Resolve vazio para forçar novo QR Code
                    } else {
                        reject(err);
                    }
                })
                .on('finish', resolve);
        });
    }

    async delete(options) {
        const cleanId = path.basename(options.session);
        const db = this.mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: this.bucketName });

        const cursor = bucket.find({ filename: cleanId });
        const docs = await cursor.toArray();
        
        if (docs.length > 0) {
            await Promise.all(docs.map(doc => bucket.delete(doc._id)));
        }
    }
}

module.exports = UnifiedMongoStore;