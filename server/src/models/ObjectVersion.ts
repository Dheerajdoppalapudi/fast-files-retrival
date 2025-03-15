import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, OneToMany } from 'typeorm';
import { MyItem } from './Myitem';
import { Approval } from './Approval';
import { Approver } from './Approver';
import { User } from './userModel';

@Entity({ name: 'object_versions' })
@Index(['objectId', 'isLatest'])
export class ObjectVersion {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => MyItem, (object) => object.versions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'objectId' })
    object!: MyItem;

    @Column({ type: 'int' })
    objectId!: number;

    @Column({ type: 'varchar', length: 255 })
    versionId!: string;

    @Column({ type: 'int' }) // User who uploaded the version
    userId!: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    uploader!: User;

    @Column({ type: 'int' }) // Size of the file in bytes
    size!: number;

    @Column({ type: 'varchar', length: 255, unique: true }) // ETag for the file
    etag!: string;

    @Column({ type: 'boolean', default: false }) // Is this the latest version?
    isLatest!: boolean;

    @Column({ type: 'boolean', default: false }) // Is this a delete marker?
    deleteMarker!: boolean;

    @Column({ type: 'varchar', default: 'pending' }) // Approval status: 'pending', 'approved', 'rejected'
    status!: string;

    @Column({ type: 'int', nullable: true }) // Default approver for this version
    approverId?: number;

    @ManyToOne(() => Approver, { nullable: true })
    @JoinColumn({ name: 'approverId' })
    approver?: Approver;

    @OneToMany(() => Approval, (approval) => approval.objectVersion)
    approvals!: Approval[];

    @CreateDateColumn({ type: 'datetime' })
    createdAt!: Date;
}