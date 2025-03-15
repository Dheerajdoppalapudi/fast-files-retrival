import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Bucket } from './Bucket';
import { MyItem } from './Myitem';
import { User } from './userModel';

@Entity({ name: 'permissions' })
export class Permission {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', nullable: true }) // Bucket ID (if permission is at bucket level)
    bucketId?: number;

    @Column({ type: 'int', nullable: true }) // Item ID (if permission is at item level)
    itemId?: number;

    @Column({ type: 'int' }) // User ID
    userId!: number;

    @Column({ type: 'varchar', length: 50 }) // Permission type: 'read', 'write', 'admin'
    permissionType!: string;

    @ManyToOne(() => Bucket, (bucket) => bucket.permissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'bucketId' })
    bucket?: Bucket;

    @ManyToOne(() => MyItem, (item) => item.permissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'itemId' })
    item?: MyItem;

    @ManyToOne(() => User, (user) => user.permissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;
}