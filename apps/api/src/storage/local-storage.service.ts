import {
  Injectable,
} from '@nestjs/common';

import {
  mkdir,
  unlink,
  writeFile,
} from 'node:fs/promises';

import {
  existsSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

import {
  randomUUID,
} from 'node:crypto';

@Injectable()
export class LocalStorageService {
  private readonly uploadDir =
    join(
      process.cwd(),
      'uploads',
    );

  async upload(
    file: Express.Multer.File,
    folder: string,
  ) {
    const folderPath =
      join(
        this.uploadDir,
        folder,
      );

    if (!existsSync(folderPath)) {
      await mkdir(
        folderPath,
        {
          recursive: true,
        },
      );
    }

    const extension =
      file.originalname
        .split('.')
        .pop();

    const storageKey =
      `${folder}/${randomUUID()}.${extension}`;

    const filePath =
      join(
        this.uploadDir,
        storageKey,
      );

    await writeFile(
      filePath,
      file.buffer,
    );

    return {
      storageKey,
      fileName:
        file.originalname,
      mimeType:
        file.mimetype,
      fileSize:
        file.size,
    };
  }

  async delete(
    storageKey: string,
  ) {
    const filePath =
      join(
        this.uploadDir,
        storageKey,
      );

    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  getUrl(
    storageKey: string,
  ) {
    return `/uploads/${storageKey}`;
  }
}