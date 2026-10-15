import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './task.schema';
import { Member, MemberDocument } from '../members/member.schema';
import { Workspace, WorkspaceDocument } from '../members/workspace.schema';
import { User, UserDocument } from '../users/user.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksGateway } from './tasks.gateway';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly tasksGateway: TasksGateway,
  ) {}

  private validateSubtaskDates(dueDateStr?: string, subtasks?: any[]) {
    if (!subtasks || subtasks.length === 0) return;

    const parseDateToTimestamp = (dStr?: string): number | undefined => {
      if (!dStr) return undefined;
      const trimmed = dStr.trim();
      if (!trimmed) return undefined;

      // Handle DD Month YYYY or DD Month e.g. "10 Aug 2026" or "10 Aug"
      if (/^\d{1,2}\s+[A-Za-z]{3}(\s+\d{4})?$/.test(trimmed)) {
        const fullStr = /^\d{1,2}\s+[A-Za-z]{3}$/.test(trimmed) ? `${trimmed} 2026` : trimmed;
        const d = new Date(fullStr);
        if (!isNaN(d.getTime())) return d.getTime();
      }

      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d.getTime();
      return undefined;
    };

    let startTimestamp: number | undefined;
    let endTimestamp: number | undefined;

    if (dueDateStr) {
      if (dueDateStr.includes(' to ')) {
        const parts = dueDateStr.split(' to ');
        startTimestamp = parseDateToTimestamp(parts[0]);
        endTimestamp = parseDateToTimestamp(parts[1]);
      } else {
        endTimestamp = parseDateToTimestamp(dueDateStr);
      }
    }

    for (const sub of subtasks) {
      if (sub && sub.dueDate) {
        const subTimestamp = parseDateToTimestamp(sub.dueDate);
        if (subTimestamp === undefined) continue;

        if (startTimestamp !== undefined && subTimestamp < startTimestamp) {
          const startDateFormatted = dueDateStr?.split(' to ')[0] || '';
          throw new BadRequestException(
            `Due date of subtask "${sub.title || 'Untitled'}" (${sub.dueDate}) cannot be before task start date (${startDateFormatted})`,
          );
        }
        if (endTimestamp !== undefined && subTimestamp > endTimestamp) {
          const endDateFormatted = dueDateStr?.includes(' to ') ? dueDateStr.split(' to ')[1] : dueDateStr;
          throw new BadRequestException(
            `Due date of subtask "${sub.title || 'Untitled'}" (${sub.dueDate}) cannot be after task end date (${endDateFormatted})`,
          );
        }
      }
    }
  }

  async getAccessibleOwnerIds(userId: string): Promise<string[]> {
    const user = await this.userModel.findById(userId).exec();
    const cleanUsername = user?.username || user?.name?.toLowerCase().replace(/\s+/g, '_');
    const userEmail = user?.email?.toLowerCase();

    const memberRecords = await this.memberModel
      .find({
        $or: [
          { memberUserId: userId },
          ...(cleanUsername ? [{ username: cleanUsername }] : []),
          ...(userEmail ? [{ email: userEmail }] : []),
        ],
      })
      .exec();

    const accessible = [userId];
    for (const mem of memberRecords) {
      if (mem.userId && !accessible.includes(mem.userId)) {
        accessible.push(mem.userId);
      }
    }
    return accessible;
  }

  private async notifyAssignee(assignee: string, taskTitle: string, taskId: string, actorUserId: string) {
    if (!assignee || assignee.toLowerCase() === 'you') return;
    const clean = assignee.toLowerCase().replace(/^@/, '').trim();
    let assignedUserId: string | null = null;

    const assignedUser = await this.userModel
      .findOne({
        $or: [
          { username: clean },
          { name: { $regex: new RegExp(`^${assignee.trim()}$`, 'i') } },
        ],
      })
      .exec();

    if (assignedUser) {
      assignedUserId = assignedUser._id.toString();
    } else {
      const member = await this.memberModel
        .findOne({
          $or: [
            { username: clean },
            { name: { $regex: new RegExp(`^${assignee.trim()}$`, 'i') } },
          ],
        })
        .exec();
      if (member?.memberUserId) {
        assignedUserId = member.memberUserId;
      }
    }

    // Only notify the assigned user (creator/owner does NOT receive notification)
    if (assignedUserId && assignedUserId !== actorUserId) {
      const actor = await this.userModel.findById(actorUserId).exec();
      const actorName = actor?.name || 'Workspace Member';
      await this.notificationsService.create({
        recipientUserId: assignedUserId,
        type: 'task_assigned',
        title: 'Task Assigned',
        message: `${actorName} assigned you to task "${taskTitle}".`,
        link: '/dashboard',
        actorId: actorUserId,
        actorName,
        metadata: {
          taskId,
          taskTitle,
          actorName,
        },
      });
    }
  }

  private async buildWorkspaceFilter(targetId: string, workspaceId?: string): Promise<Record<string, any>> {
    const filter: Record<string, any> = { userId: targetId };
    if (!workspaceId) {
      return filter;
    }

    // Find the owner's primary (oldest) workspace to handle legacy tasks created without workspaceId
    const firstWs = await this.workspaceModel.findOne({ ownerId: targetId }).sort({ createdAt: 1 }).exec();
    const primaryWsId = firstWs?._id.toString();

    const isPrimary = workspaceId === primaryWsId || workspaceId === 'ws-default' || !primaryWsId;

    if (isPrimary) {
      filter.$or = [
        { workspaceId },
        ...(primaryWsId ? [{ workspaceId: primaryWsId }] : []),
        { workspaceId: 'ws-default' },
        { workspaceId: { $exists: false } },
        { workspaceId: null },
        { workspaceId: '' },
      ];
    } else {
      filter.workspaceId = workspaceId;
    }

    return filter;
  }

  async create(createTaskDto: CreateTaskDto, userId: string, workspaceOwnerId?: string, workspaceId?: string): Promise<Task> {
    this.validateSubtaskDates(createTaskDto.dueDate, createTaskDto.subtasks);
    const accessible = await this.getAccessibleOwnerIds(userId);
    let targetUserId = userId;
    if (workspaceOwnerId && accessible.includes(workspaceOwnerId)) {
      targetUserId = workspaceOwnerId;
    }

    let finalWorkspaceId = workspaceId || createTaskDto.workspaceId;
    if (!finalWorkspaceId || finalWorkspaceId === 'ws-default') {
      const firstWs = await this.workspaceModel.findOne({ ownerId: targetUserId }).sort({ createdAt: 1 }).exec();
      finalWorkspaceId = firstWs?._id.toString() || 'ws-default';
    }

    const creator = await this.userModel.findById(userId).exec();
    const creatorName = createTaskDto.creatorName || creator?.name || 'Workspace Member';

    const task = new this.taskModel({
      ...createTaskDto,
      workspaceId: finalWorkspaceId,
      userId: targetUserId,
      createdBy: userId,
      creatorName,
    });
    const saved = await task.save();

    if (createTaskDto.assignee) {
      await this.notifyAssignee(createTaskDto.assignee, saved.title, saved._id.toString(), userId);
    }

    this.tasksGateway.emitTaskCreated(saved);

    return saved;
  }

  async findAll(userId: string, filters: FilterTasksDto, workspaceOwnerId?: string, workspaceId?: string): Promise<Task[]> {
    const accessible = await this.getAccessibleOwnerIds(userId);
    let targetId = userId;
    if (workspaceOwnerId && accessible.includes(workspaceOwnerId)) {
      targetId = workspaceOwnerId;
    } else if (workspaceOwnerId && !accessible.includes(workspaceOwnerId)) {
      return [];
    }

    const baseQuery = await this.buildWorkspaceFilter(targetId, workspaceId || filters.workspaceId);
    const query: Record<string, any> = { ...baseQuery };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.search) {
      const searchCondition = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: searchCondition },
        ];
        delete query.$or;
      } else {
        query.$or = searchCondition;
      }
    }

    return this.taskModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, userId: string): Promise<Task> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    const accessible = await this.getAccessibleOwnerIds(userId);
    const task = await this.taskModel.findById(id).exec();
    if (!task || !accessible.includes(task.userId)) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    if (!task.creatorName) {
      const creator = await this.userModel.findById(task.createdBy || task.userId).exec();
      if (creator) {
        task.creatorName = creator.name;
      }
    }
    return task;
  }

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
  ): Promise<Task> {
    const existingTask = await this.findOne(id, userId);

    // Creator check: task creator or workspace owner
    const isCreator = existingTask.createdBy === userId || existingTask.userId === userId;

    if (updateTaskDto.isLocked !== undefined && updateTaskDto.isLocked !== existingTask.isLocked && !isCreator) {
      throw new BadRequestException('Only the creator of the task can lock or unlock it');
    }

    if (existingTask.isLocked && !isCreator) {
      // Non-creators can ONLY change the status of a locked task
      const allowedDto: UpdateTaskDto = {};
      if (updateTaskDto.status !== undefined) {
        allowedDto.status = updateTaskDto.status;
      }
      updateTaskDto = allowedDto;
    }

    const dueDateStr =
      updateTaskDto.dueDate !== undefined
        ? updateTaskDto.dueDate
        : existingTask.dueDate;
    const subtasks =
      updateTaskDto.subtasks !== undefined
        ? updateTaskDto.subtasks
        : existingTask.subtasks;

    this.validateSubtaskDates(dueDateStr, subtasks);

    const task = await this.taskModel
      .findByIdAndUpdate(id, updateTaskDto, { returnDocument: 'after' })
      .exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    if (updateTaskDto.assignee && updateTaskDto.assignee !== existingTask.assignee) {
      await this.notifyAssignee(updateTaskDto.assignee, task.title, task._id.toString(), userId);
    }

    this.tasksGateway.emitTaskUpdated(task);

    return task;
  }

  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    const accessible = await this.getAccessibleOwnerIds(userId);
    const task = await this.taskModel.findById(id).exec();
    if (!task || !accessible.includes(task.userId)) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const isCreator = task.createdBy === userId || task.userId === userId;
    if (task.isLocked && !isCreator) {
      throw new BadRequestException('Only the creator of the task can delete a locked task');
    }

    await this.taskModel.findByIdAndDelete(id).exec();
    this.tasksGateway.emitTaskDeleted(id, task.userId, task.workspaceId);
    return { deleted: true };
  }

  async getStats(userId: string, workspaceOwnerId?: string, workspaceId?: string): Promise<{
    total: number;
    todo: number;
    doing: number;
    inProgress: number;
    completed: number;
    done: number;
    onHold: number;
  }> {
    const accessible = await this.getAccessibleOwnerIds(userId);
    let targetId = userId;
    if (workspaceOwnerId && accessible.includes(workspaceOwnerId)) {
      targetId = workspaceOwnerId;
    }

    const baseQuery = await this.buildWorkspaceFilter(targetId, workspaceId);

    const [total, todo, doing, inProgress, completed, done, onHold] = await Promise.all([
      this.taskModel.countDocuments(baseQuery as Record<string, any>),
      this.taskModel.countDocuments({
        ...baseQuery,
        status: TaskStatus.TODO,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        ...baseQuery,
        status: TaskStatus.DOING,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        ...baseQuery,
        status: TaskStatus.IN_PROGRESS,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        ...baseQuery,
        status: TaskStatus.COMPLETED,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        ...baseQuery,
        status: TaskStatus.DONE,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        ...baseQuery,
        status: TaskStatus.ON_HOLD,
      } as Record<string, any>),
    ]);
    return {
      total,
      todo,
      doing: doing + inProgress,
      inProgress: doing + inProgress,
      completed: completed + done,
      done: completed + done,
      onHold,
    };
  }
}
