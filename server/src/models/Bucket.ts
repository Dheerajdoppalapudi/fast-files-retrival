import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { MyItem } from './Myitem';
import { Permission } from './Permission';
import { Approval } from './Approval';
import {Approver} from "./Approver"

@Entity({ name: 'buckets' })
export class Bucket {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'int', nullable: true }) // Parent bucket ID (for nested buckets)
    parentId?: number;

    @Column({ type: 'int' }) // User who created the bucket
    userId!: number;

    @Column({ type: 'boolean', default: true }) // Whether approval workflow is required for this bucket
    requiresApproval!: boolean;

    @Column({ type: 'boolean', default: true }) // Whether approval workflow is required for this bucket
    ownerAutoApproves!: boolean;

    @Column({ type: 'int', nullable: true }) // Default approver group for this bucket
    defaultApproverId?: number;

    @ManyToOne(() => Approver, { nullable: true })
    @JoinColumn({ name: 'defaultApproverId' })
    defaultApprover?: Approver;

    @Column({ type: 'varchar', default: 'pending' }) // Approval status: 'pending', 'approved', 'rejected'
    approvalStatus!: string;

    @CreateDateColumn({ type: 'datetime' })
    createdAt!: Date;

    @ManyToOne(() => Bucket, (bucket) => bucket.children, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'parentId' })
    parent?: Bucket;

    @OneToMany(() => Bucket, (bucket) => bucket.parent)
    children!: Bucket[];

    @OneToMany(() => MyItem, (object) => object.bucket)
    objects!: MyItem[];

    @OneToMany(() => Permission, (permission) => permission.bucket)
    permissions!: Permission[];

    @OneToMany(() => Approval, (approval) => approval.bucket)
    approvals!: Approval[];
}
