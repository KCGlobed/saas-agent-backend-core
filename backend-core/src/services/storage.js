const { Storage } = require('@google-cloud/storage');
const path = require('path');

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCS_ENABLED = !!BUCKET_NAME;

let storage = null;
let bucket = null;

if (GCS_ENABLED) {
  try {
    const options = {};
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      options.keyFilename = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    storage = new Storage(options);
    bucket = storage.bucket(BUCKET_NAME);
    console.log(`[GCS] Storage initialized with bucket: ${BUCKET_NAME}`);
  } catch (err) {
    console.warn('[GCS] Failed to initialize storage:', err.message);
  }
} else {
  console.warn('[GCS] GCS_BUCKET_NAME not set. Files will NOT be persisted to GCS.');
}

/**
 * Upload a Buffer to GCS.
 * @param {Buffer} buffer - File content
 * @param {string} gcsPath - Destination path in the bucket (e.g., "projects/abc/uuid.pdf")
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} The GCS path on success, null if GCS is disabled.
 */
async function uploadFile(buffer, gcsPath, contentType = 'application/octet-stream') {
  if (!bucket) return null;
  const file = bucket.file(gcsPath);
  await file.save(buffer, { contentType, resumable: false });
  return gcsPath;
}

/**
 * Delete a file from GCS.
 * @param {string} gcsPath - GCS object path
 */
async function deleteFile(gcsPath) {
  if (!bucket || !gcsPath) return;
  try {
    await bucket.file(gcsPath).delete();
  } catch (err) {
    // Don't throw if file doesn't exist
    if (err.code !== 404) throw err;
  }
}

/**
 * Get a signed URL for a GCS object (valid for 15 minutes).
 * @param {string} gcsPath
 * @returns {Promise<string|null>}
 */
async function getSignedUrl(gcsPath) {
  if (!bucket || !gcsPath) return null;
  const [url] = await bucket.file(gcsPath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000 // 15 minutes
  });
  return url;
}

module.exports = { uploadFile, deleteFile, getSignedUrl, GCS_ENABLED };
