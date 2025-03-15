import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Bucket } from './Bucket';
import { User } from './userModel';
import { MyItem } from './Myitem';

@Entity({ name: 'approvers' })
export class Approver {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'boolean', default: false })
    isGroup!: boolean;

    @ManyToMany(() => User)
    @JoinTable({
        name: "approver_users",
        joinColumn: {
            name: "approverId",
            referencedColumnName: "id"
        },
        inverseJoinColumn: {
            name: "userId",
            referencedColumnName: "id"
        }
    })
    users!: User[];

    @Column({ type: 'varchar', length: 50, default: 'standard' }) 
    // Type of approval: 'standard' (any approver can approve), 'unanimous' (all approvers must approve), etc.
    approvalType!: string;

    @Column({ type: 'int', default: 1 }) 
    // Minimum number of approvals required (for standard type)
    minApprovals!: number;

    @CreateDateColumn({ type: 'datetime' })
    createdAt!: Date;
}
