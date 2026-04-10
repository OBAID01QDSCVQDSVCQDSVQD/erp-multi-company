import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: `https://${process.env.S3_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true, // Required for MinIO
});

const bucketName = process.env.S3_BUCKET || "chanti-assets";

export async function uploadFileToS3(
  file: Buffer | Uint8Array | Blob | string,
  fileName: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  try {
    const key = `uploads/${Date.now()}-${fileName.replace(/\s+/g, "-")}`;
    
    let body: Buffer | Uint8Array;
    if (file instanceof Blob) {
      const arrayBuffer = await file.arrayBuffer();
      body = new Uint8Array(arrayBuffer);
    } else if (typeof file === "string") {
      // Base64 handling if needed
      body = Buffer.from(file.replace(/^data:image\/\w+;base64,/, ""), "base64");
    } else {
      body = file;
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Public read permission depends on your MinIO bucket policy, 
      // but we set it here as well
      ACL: "public-read",
    });
    await s3Client.send(command);

    // Final optimized imgproxy URL
    const imgUrl = `s3://${bucketName}/${key}`;
    const imgproxyUrl = `https://imgproxy.chanti.tn/insecure/rs:fill:800:0/q:80/plain/${imgUrl}@webp`;
    
    return { url: imgproxyUrl, key };

  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}

export async function deleteFileFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
}

export default s3Client;
