import { AppDataSource } from '../config/db';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';
import { ObjectVersion } from '../models/ObjectVersion';
import { getFinalFilePath } from '../utils/storage';
import fs from 'fs';

export const rejectVersionService = async (versionId: string) => {
    const versionRepository = AppDataSource.getRepository(ObjectVersion);

    const version = await versionRepository.findOne({ where: { id:versionId } });
    if (!version) throw new Error('Version not found');

    // Get the item associated with the version
    const myItem = await AppDataSource.getRepository(MyItem).findOne({ where: { id: version.objectId } });
    if (!myItem) throw new Error('Item not found');

    // Get the bucket associated with the item
    const bucket = await AppDataSource.getRepository(Bucket).findOne({ where: { id: myItem.bucketId } });
    if (!bucket) throw new Error('Bucket not found');

    // Delete the file
    const finalFilePath = getFinalFilePath(bucket.name, myItem.key, version.id);
    if (fs.existsSync(finalFilePath)) {
        fs.unlinkSync(finalFilePath);
    }

    // Mark the version as rejected
    version.status = 'rejected';
    await versionRepository.save(version);

    return { message: 'Version rejected successfully', version };
};