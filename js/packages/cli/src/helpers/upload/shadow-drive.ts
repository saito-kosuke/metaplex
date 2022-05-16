import log from 'loglevel';
import { basename, extname } from 'path';
import { ReadStream, createReadStream, readFileSync } from 'fs';
import { getType } from 'mime';
import { setImageUrlManifest } from './file-uri';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import shadowDrive from '@shadow-drive/sdk';
import FormData from 'form-data';

async function uploadFile(
  walletKeyPair: Keypair,
  shadowDriveStorageAccountPublicKey: string,
  filename: string,
  contentType: string,
  fileData: ReadStream | Buffer,
): Promise<string> {
  const connection = new Connection('https://ssc-dao.genesysgo.net/');
  const wallet = new Wallet(walletKeyPair);

  const drive = await new shadowDrive(connection, wallet).init();
  const storageAccountPublicKey = new PublicKey(
    shadowDriveStorageAccountPublicKey,
  );
  const storageAccount = await drive.getStorageAccount(storageAccountPublicKey);
  console.log('storageAccount', storageAccount);
  const fd = new FormData();
  fd.append('file', fileData, {
    contentType: contentType,
    filename: filename,
  });
  const { finalized_location } = await drive.uploadFile(
    storageAccountPublicKey,
    fd,
  );
  return finalized_location;
}

export async function shadowDriveUpload(
  walletKeyPair: Keypair,
  image: string,
  animation: string,
  manifestBuffer: Buffer,
  shadowDriveStorageAccountPublicKey: string,
) {
  async function uploadMedia(media: string): Promise<string> {
    const mediaPath = `assets/${basename(media)}`;
    log.debug('media:', media);
    log.debug('mediaPath:', mediaPath);
    const mediaUrl = await uploadFile(
      walletKeyPair,
      shadowDriveStorageAccountPublicKey,
      mediaPath,
      getType(media),
      readFileSync(media),
    );
    return mediaUrl;
  }

  const imageUrl = await uploadMedia(image);
  console.log('imageUrl', imageUrl);
  const animationUrl = animation ? await uploadMedia(animation) : undefined;
  console.log('animationUrl', animationUrl);
  const manifestJson = await setImageUrlManifest(
    manifestBuffer.toString('utf8'),
    imageUrl,
    animationUrl,
  );

  const updatedManifestBuffer = Buffer.from(JSON.stringify(manifestJson));

  const extensionRegex = new RegExp(`${extname(image)}$`);
  const metadataFilename = image.replace(extensionRegex, '.json');
  const metadataUrl = await uploadFile(
    walletKeyPair,
    shadowDriveStorageAccountPublicKey,
    metadataFilename,
    'application/json',
    updatedManifestBuffer,
  );
  console.log('metadataUrl', metadataUrl);
  return [metadataUrl, imageUrl, animationUrl];
}
