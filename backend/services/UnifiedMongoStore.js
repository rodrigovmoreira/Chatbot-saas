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

        const cursor = bucket.find({ filename: cleanId });
        const docs = await cursor.limit(1).toArray();
        return docs.length > 0;
    }

    async save(options) {
        const cleanId = path.basename(options.session);
        const db = this.mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: this.bucketName });

        // 1. Apaga backup anterior do banco (evita lixo)
        await this.delete(options);

        const possiblePath1 = path.resolve(process.cwd(), '.wwebjs_auth', `${cleanId}.zip`);
        const possiblePath2 = path.resolve(process.cwd(), `${cleanId}.zip`);
        const possiblePath3 = `${options.session}.zip`; // Caminho relativo cru enviado pela lib

        let fileToUpload = null;

        if (fs.existsSync(possiblePath1)) {
            fileToUpload = possiblePath1;
        } else if (fs.existsSync(possiblePath2)) {
            fileToUpload = possiblePath2;
        } else if (fs.existsSync(possiblePath3)) {
            fileToUpload = possiblePath3;
        }

        if (!fileToUpload) {
            // console.warn(`⚠️ [UnifiedMongoStore] Arquivo ZIP não encontrado para backup. Tentaremos no próximo ciclo.`);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            fs.createReadStream(fileToUpload)
                .pipe(bucket.openUploadStream(cleanId))
                .on('error', reject)
                .on('finish', () => {
                    // Opcional: Se achou o arquivo perdido na raiz, apaga ele para limpar a casa
                    if (fileToUpload === possiblePath2) {
                        try { fs.unlinkSync(fileToUpload); } catch (e) { }
                    }
                    resolve();
                });
        });
    }

    async extract(options) {
        const cleanId = path.basename(options.session);
        const db = this.mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: this.bucketName });

        // Caminho de destino: Sempre forçamos para dentro da pasta organizada
        const destinationPath = path.resolve(process.cwd(), '.wwebjs_auth', `${cleanId}.zip`);
        const dirPath = path.dirname(destinationPath);

        // 1. Garante que a pasta existe
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // 2. Verifica se tem o que baixar
        const exists = await this.sessionExists(options);
        if (!exists) {
            // Se não tem no banco (Sessão Nova ou Reset), não faz nada e deixa o RemoteAuth seguir.
            return Promise.resolve();
        }

        // 3. Baixa do banco
        return new Promise((resolve, reject) => {
            bucket.openDownloadStreamByName(cleanId)
                .pipe(fs.createWriteStream(destinationPath))
                .on('error', (err) => {
                    if (err.code === 'ENOENT' || err.message.includes('FileNotFound')) {
                        resolve();
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