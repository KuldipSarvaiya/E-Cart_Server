import dotenv from "dotenv";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

dotenv.config();

// configuring s3 bukket
const S3 = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
  region: process.env.BUCKET_REGION,
}); 

export default async function getS3Url(name, expiry = 90) {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: name,
  };
  const command = new GetObjectCommand(params);
  const url = await getSignedUrl(S3, command, { expiresIn: expiry });
  console.log(url);
  return url;
}
