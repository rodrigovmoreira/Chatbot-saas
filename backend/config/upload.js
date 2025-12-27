const multer = require('multer');
const admin = require('firebase-admin');

// 1. Configura Firebase Admin
let serviceAccount;

try {
  if (process.env.FIREBASE_CREDENTIALS) {
    // Produção: JSON stringificado na variável de ambiente
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  } else {
    // Desenvolvimento: Arquivo local
    serviceAccount = require('./firebase-credentials.json');
  }

  // Inicializa apenas se ainda não estiver inicializado
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_BUCKET_URL // ex: "meu-app.appspot.com"
    });
  }
} catch (error) {
  console.error("⚠️ Erro ao configurar Firebase:", error.message);
  // Não quebra a aplicação, mas uploads falharão
}

// 2. Configura Multer para memória (necessário para o Sharp processar antes)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'), false);
    }
  }
});

// Exporta o 'upload' (middleware) e o 'bucket' (para salvar manualmente)
const bucket = admin.storage().bucket();

module.exports = { upload, bucket };
