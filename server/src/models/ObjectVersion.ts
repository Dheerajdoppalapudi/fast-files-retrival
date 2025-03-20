import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, OneToMany } from 'typeorm';
import { MyItem } from './Myitem';
import { Approval } from './Approval';
import { Approver } from './Approver';
import { User } from './userModel';
import { BaseEntity } from './BaseEntity';

@Entity({ name: 'object_versions' })
@Index(['objectId', 'isLatest'])
export class ObjectVersion extends BaseEntity {
  @ManyToOne(() => MyItem, (object) => object.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'objectId' })
  object!: MyItem;

  @Column({ type: 'uuid' })
  objectId!: string;

  @Column({ type: 'varchar', length: 255 })
  versionId!: string;

  @Column({ type: 'uuid' }) 
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  uploader!: User;

  @Column({ type: 'int' }) 
  size!: number;

  @Column({ type: 'varchar', length: 255 }) 
  etag!: string;

  @Column({ type: 'boolean', default: false }) 
  isLatest!: boolean;

  @Column({ type: 'boolean', default: false }) 
  deleteMarker!: boolean;

  @Column({ type: 'varchar', default: 'pending' }) 
  status!: string;

  @Column({ type: 'uuid', nullable: true }) 
  approverId?: string;

  @ManyToOne(() => Approver, { nullable: true })
  @JoinColumn({ name: 'approverId' })
  approver?: Approver;

  @OneToMany(() => Approval, (approval) => approval.objectVersion)
  approvals!: Approval[];

  @Column({ type: 'varchar', length: 1000, nullable: true }) 
  notes?: string;
}
