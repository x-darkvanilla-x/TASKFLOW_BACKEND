import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

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

  async create(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    this.validateSubtaskDates(createTaskDto.dueDate, createTaskDto.subtasks);
    const task = new this.taskModel({ ...createTaskDto, userId });
    return task.save();
  }

  async findAll(userId: string, filters: FilterTasksDto): Promise<Task[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    return this.taskModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, userId: string): Promise<Task> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    const task = await this.taskModel
      .findOne({ _id: id, userId } as Record<string, any>)
      .exec();
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
  ): Promise<Task> {
    const existingTask = await this.findOne(id, userId);
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
      .findOneAndUpdate(
        { _id: id, userId } as Record<string, any>,
        updateTaskDto,
        { returnDocument: 'after' },
      )
      .exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    const result = await this.taskModel
      .findOneAndDelete({ _id: id, userId } as Record<string, any>)
      .exec();

    if (!result) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return { deleted: true };
  }

  async getStats(userId: string): Promise<{
    total: number;
    todo: number;
    doing: number;
    inProgress: number;
    completed: number;
    done: number;
    onHold: number;
  }> {
    const [total, todo, doing, inProgress, completed, done, onHold] = await Promise.all([
      this.taskModel.countDocuments({ userId } as Record<string, any>),
      this.taskModel.countDocuments({
        userId,
        status: TaskStatus.TODO,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        userId,
        status: TaskStatus.DOING,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        userId,
        status: TaskStatus.IN_PROGRESS,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        userId,
        status: TaskStatus.COMPLETED,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        userId,
        status: TaskStatus.DONE,
      } as Record<string, any>),
      this.taskModel.countDocuments({
        userId,
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
