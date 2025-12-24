const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Configura o Cloudinary com suas credenciais
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configura o "Storage" (Onde e como salvar)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chatbot-catalogo', // Nome da pasta que será criada no seu Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'], // Formatos aceitos
    transformation: [{ width: 800, height: 800, crop: 'limit' }] // Opcional: Redimensiona para economizar dados
  },
});

// 3. Cria o middleware do Multer
const upload = multer({ storage: storage });

module.exports = upload;