import {HttpsError} from "firebase-functions/https";
import {storage} from "../config/firebase.js";

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

/**
 * Saves a base64 data-url image to storage under `${pathPrefix}.${ext}`,
 * removing any previously uploaded file(s) under that prefix first so
 * re-uploads with a different extension don't leave orphaned files behind.
 * @param {string} base64Image data-url encoded image.
 * @param {string} pathPrefix storage path (without extension) to save under.
 * @return {Promise<string>} the public URL of the uploaded file.
 */
export async function uploadImage(base64Image, pathPrefix) {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new HttpsError("invalid-argument", "File too large, max 3MB");
  }

  const match = base64Image.match(/^data:(image\/\w+);base64,/);
  const contentType = match ? match[1] : "image/jpeg";
  const ext = contentType.split("/")[1];

  const bucket = storage.bucket();
  await bucket.deleteFiles({prefix: `${pathPrefix}.`});

  const filePath = `${pathPrefix}.${ext}`;
  const file = bucket.file(filePath);

  await file.save(buffer, {metadata: {contentType}});
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}
