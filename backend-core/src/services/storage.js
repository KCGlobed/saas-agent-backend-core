const { Storage } = require('@google-cloud/storage');
const path = require('path');

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCS_ENABLED = !!BUCKET_NAME;

let storage = null;
let bucket = null;

if (GCS_ENABLED) {
  try {
    const options = {};
    
    // Explicitly use the local serviceAccount.json ONLY if we are NOT in Cloud Run
    // Cloud Run automatically sets the K_SERVICE environment variable.
    if (!process.env.K_SERVICE) {
      const localKeyPath = path.resolve(process.cwd(), 'serviceAccount.json');
      console.log('[GCS] Running locally (no K_SERVICE). Using local serviceAccount.json.');
      options.keyFilename = localKeyPath;
    } else {
      console.log('[GCS] Running in Cloud Run. Using automatic Cloud Run authentication.');
      // Prevent the underlying Google SDK from accidentally using a bad environment variable
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
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
