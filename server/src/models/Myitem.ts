import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Unique, CreateDateColumn } from 'typeorm';
import { Bucket } from './Bucket';
import { ObjectVersion } from './ObjectVersion';
import { Permission } from './Permission';
import { Approval } from './Approval';
import { Approver } from './Approver';
import { User } from './userModel';

@Entity({ name: 'MyItems' })
@Unique(['bucket', 'key'])
export class MyItem {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    key!: string;

    @ManyToOne(() => Bucket, (bucket) => bucket.objects, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'bucketId' })
    bucket!: Bucket;

    @Column({ type: 'int' })
    bucketId!: number;

    @Column({ type: 'int' }) // User who created the item (owner)
    userId!: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    owner!: User;

    @Column({ type: 'boolean', default: true }) // Versioning enabled for this item
    versioningEnabled!: boolean;

    @Column({ type: 'boolean', default: false }) // Whether this item requires approval
    requiresApproval!: boolean;

    @Column({ type: 'int', nullable: true }) // Default approver for this item
    defaultApproverId?: number;

    @ManyToOne(() => Approver, { nullable: true })
    @JoinColumn({ name: 'defaultApproverId' })
    defaultApprover?: Approver;

    @Column({ type: 'varchar', default: 'pending' }) // Approval status: 'pending', 'approved', 'rejected'
    approvalStatus!: string;

    @CreateDateColumn({ type: 'datetime' })
    createdAt!: Date;

    @OneToMany(() => ObjectVersion, (version) => version.object, { cascade: true, onDelete: 'CASCADE' })
    versions!: ObjectVersion[];

    @OneToMany(() => Permission, (permission) => permission.item)
    permissions!: Permission[];

    @OneToMany(() => Approval, (approval) => approval.item)
    approvals!: Approval[];
}