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

        await this.delete(options);

        // Busca ZIP na pasta correta ou na raiz (fallback)
        const possiblePath1 = path.resolve(process.cwd(), '.wwebjs_auth', `${cleanId}.zip`);
        const possiblePath2 = path.resolve(process.cwd(), `${cleanId}.zip`);
        const possiblePath3 = `${options.session}.zip`;

        let fileToUpload = null;
        if (fs.existsSync(possiblePath1)) fileToUpload = possiblePath1;
        else if (fs.existsSync(possiblePath2)) fileToUpload = possiblePath2;
        else if (fs.existsSync(possiblePath3)) fileToUpload = possiblePath3;

        if (!fileToUpload) return Promise.resolve();

        console.log(`💾 [Store] Iniciando BACKUP de ${cleanId}...`);

        return new Promise((resolve, reject) => {
            fs.createReadStream(fileToUpload)
                .pipe(bucket.openUploadStream(cleanId))
                .on('error', reject)
                .on('finish', () => {
                    console.log(`✅ [Store] Backup salvo: ${cleanId}`);
                    if (fileToUpload === possiblePath2) {
                        try { fs.unlinkSync(fileToUpload); } catch(e) {}
                    }
                    resolve();
                });
        });
    }

    async extract(options) {
        const cleanId = path.basename(options.session);
        const db = this.mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
        
        const destinationPath = path.resolve(process.cwd(), '.wwebjs_auth', `${cleanId}.zip`);
        const dirPath = path.dirname(destinationPath);
        
        // Caminho da pasta descompactada (onde o Chrome roda)
        // O padrão do RemoteAuth é criar uma pasta com o nome da sessão dentro de .wwebjs_auth
        const sessionFolder = path.join(dirPath, `session-${cleanId}`); // Ajuste para padrão wwebjs
        const remoteAuthFolder = path.join(dirPath, cleanId); // Ajuste para padrão RemoteAuth

        console.log(`📥 [Store] Restore solicitado para ${cleanId}`);

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // 🛡️ FAXINA PRÉ-RESTORE: Apaga a pasta da sessão se existir para evitar corrupção (IndexedDB Lock)
        try {
            if (fs.existsSync(sessionFolder)) fs.rmSync(sessionFolder, { recursive: true, force: true });
            if (fs.existsSync(remoteAuthFolder)) fs.rmSync(remoteAuthFolder, { recursive: true, force: true });
        } catch (e) {
            console.warn(`⚠️ [Store] Aviso ao limpar pasta antiga: ${e.message}`);
        }

        const exists = await this.sessionExists(options);
        
        if (!exists) {
            console.log(`🤷‍♂️ [Store] Sem backup no banco para ${cleanId}.`);
            return Promise.resolve();
        }

        console.log(`⬇️ [Store] Baixando ZIP do banco...`);

        return new Promise((resolve, reject) => {
            bucket.openDownloadStreamByName(cleanId)
                .pipe(fs.createWriteStream(destinationPath))
                .on('error', (err) => {
                    console.error('❌ [Store] Falha no download:', err);
                    resolve(); 
                })
                .on('finish', () => {
                    console.log(`✅ [Store] Download OK!`);
                    resolve();
                });
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