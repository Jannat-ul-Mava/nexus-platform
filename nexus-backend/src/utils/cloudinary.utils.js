const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload buffer to Cloudinary
exports.uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'nexus',
        resource_type: options.resourceType || 'auto',
        ...options
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// Delete file from Cloudinary
exports.deleteFromCloudinary = async (publicId, resourceType = 'auto') => {
  return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

// Generate a signed URL (for private documents)
exports.getSignedUrl = (publicId, expiresInSeconds = 3600) => {
  return cloudinary.url(publicId, {
    sign_url: true,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds
  });
};

module.exports.cloudinary = cloudinary;
