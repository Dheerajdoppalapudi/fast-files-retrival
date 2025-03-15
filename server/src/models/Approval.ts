import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ObjectVersion } from './ObjectVersion';
import { User } from './userModel';
import { Approver } from './Approver';
import {Bucket} from './Bucket'
import {MyItem} from './Myitem'

@Entity({ name: 'approvals' })
export class Approval {
    @PrimaryGeneratedColumn()
    id!: number;

    // The entity this approval is for (only one of these should be set)
    @Column({ type: 'int', nullable: true })
    objectVersionId?: number;

    @ManyToOne(() => ObjectVersion, (objectVersion) => objectVersion.approvals, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'objectVersionId' })
    objectVersion?: ObjectVersion;

    @Column({ type: 'int', nullable: true })
    bucketId?: number;

    @ManyToOne(() => Bucket, (bucket) => bucket.approvals, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'bucketId' })
    bucket?: Bucket;

    @Column({ type: 'int', nullable: true })
    itemId?: number;

    @ManyToOne(() => MyItem, (item) => item.approvals, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'itemId' })
    item?: MyItem;

    // The approval metadata
    @Column({ type: 'int' })
    approverId!: number;

    @ManyToOne(() => Approver, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'approverId' })
    approver!: Approver;

    @Column({ type: 'int' })
    userId!: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column({ type: 'varchar', length: 50 })  // 'approved', 'rejected', 'pending'
    decision!: string;

    @Column({ type: 'text', nullable: true })
    comments?: string;

    @CreateDateColumn({ type: 'datetime' })
    createdAt!: Date;
}