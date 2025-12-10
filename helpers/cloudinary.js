const cloudinary = require('../config/cloudinary')
const streamifier = require("streamifier");
const { extractPublicId } = require('cloudinary-build-url');

function uploadToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

async function deleteFromCloudinary(imagesToDelete) {
    if (!Array.isArray(imagesToDelete) || !imagesToDelete.length) return;

    // restrict from deleting protected images, for eg: placeholder image
    const placeholderImageUrls = [
        "https://res.cloudinary.com/dzsgn2ubp/image/upload/v1765359366/placeholder_vpwjqg.avif",
        "https://res.cloudinary.com/dzsgn2ubp/image/upload/v1760335059/192.168.88.27_5173__fbtge9.png"
    ]

    const results = await Promise.allSettled(
        imagesToDelete.map(async (url) => {
            if (placeholderImageUrls.includes(url)) {
                return { status: 'protected', message: 'Image is protected and cannot be deleted.' };
            }

            const publicId = extractPublicId(url);

            try {
                await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                return { publicId, status: 'deleted' };
            } catch (err) {
                return { publicId, status: 'failed', error: err.message };
            }
        })
    );

    // Log failures or protected image actions
    results
        .filter(r => r.status === 'rejected' || r.value?.status === 'failed' || r.value?.status === 'protected')
        .forEach(r => {
            if (r.status === 'rejected') {
                console.error('Delete failed due to promise rejection:', r.reason);
            } else if (r.value?.status === 'protected') {
                console.log(`Image is protected and was not deleted.`);
            } else {
                console.error('Delete failed for publicId:', r.value.publicId, 'Error:', r.value.error);
            }
        });
}

module.exports = { uploadToCloudinary, deleteFromCloudinary };
