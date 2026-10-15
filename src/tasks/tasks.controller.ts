import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto, @Request() req) {
    const ownerId = req.headers['x-workspace-owner-id'];
    const workspaceId = (req.headers['x-workspace-id'] as string) || createTaskDto.workspaceId;
    return this.tasksService.create(createTaskDto, req.user.id, ownerId, workspaceId);
  }

  @Get()
  findAll(@Query() filters: FilterTasksDto, @Request() req) {
    const ownerId = req.headers['x-workspace-owner-id'] || (filters as any).workspaceOwnerId;
    const workspaceId = (req.headers['x-workspace-id'] as string) || filters.workspaceId;
    return this.tasksService.findAll(req.user.id, filters, ownerId, workspaceId);
  }

  @Get('stats')
  getStats(@Request() req, @Query('workspaceId') queryWsId?: string) {
    const ownerId = req.headers['x-workspace-owner-id'];
    const workspaceId = queryWsId || (req.headers['x-workspace-id'] as string);
    return this.tasksService.getStats(req.user.id, ownerId, workspaceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.tasksService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req,
  ) {
    return this.tasksService.update(id, updateTaskDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.tasksService.remove(id, req.user.id);
  }
}
