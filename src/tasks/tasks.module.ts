import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task, TaskSchema } from './task.schema';
import { Member, MemberSchema } from '../members/member.schema';
import { Workspace, WorkspaceSchema } from '../members/workspace.schema';
import { User, UserSchema } from '../users/user.schema';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { TasksGateway } from './tasks.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksGateway],
  exports: [TasksService, TasksGateway],
})
export class TasksModule {}
