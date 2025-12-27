const cloudinary = require('cloudinary').v2;

/**
 * Extracts the public ID from a Cloudinary URL and deletes the image.
 * @param {string} imageUrl - The full URL of the image.
 * @returns {Promise<object>} - The result from Cloudinary.
 */
const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
    console.warn('Invalid Cloudinary URL provided for deletion:', imageUrl);
    return null;
  }

  try {
    // Extract Public ID
    // Example: https://res.cloudinary.com/cloud_name/image/upload/v123456/chatbot-catalogo/file.jpg
    // Public ID: chatbot-catalogo/file

    const parts = imageUrl.split('/');
    const versionIndex = parts.findIndex(part => part.startsWith('v') && !isNaN(part.substring(1)));

    // Start after version, or find 'upload' and skip version if present
    let startIndex = versionIndex !== -1 ? versionIndex + 1 : parts.indexOf('upload') + 1;
    if (startIndex === 0) startIndex = parts.indexOf('image') + 2; // Fallback

    const filenameWithExt = parts.slice(startIndex).join('/');
    const publicId = filenameWithExt.substring(0, filenameWithExt.lastIndexOf('.'));

    console.log(`🗑️ Deleting from Cloudinary: ${publicId}`);

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

module.exports = { deleteFromCloudinary };
