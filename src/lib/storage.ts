export interface StorageProvider {
  uploadFile(buffer: Buffer, contentType: string, ext: string): Promise<string>; // Returns fileId
  getFileUrl(fileId: string): Promise<string>;
}
