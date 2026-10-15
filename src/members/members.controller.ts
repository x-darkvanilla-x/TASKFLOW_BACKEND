import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('search')
  search(@Query('q') q: string, @Request() req) {
    return this.membersService.searchUsers(q, req.user.id);
  }

  @Post()
  create(@Body() createMemberDto: CreateMemberDto, @Request() req) {
    return this.membersService.create(createMemberDto, req.user.id);
  }

  @Get('workspaces')
  getMyWorkspaces(@Request() req) {
    return this.membersService.getMyWorkspaces(req.user.id);
  }

  @Post('workspaces')
  createWorkspace(@Body() dto: { name: string; icon?: string; color?: string }, @Request() req) {
    return this.membersService.createWorkspace(dto, req.user.id);
  }

  @Patch('workspaces/:id')
  updateWorkspace(
    @Param('id') id: string,
    @Body() dto: { name?: string; icon?: string; color?: string },
    @Request() req,
  ) {
    return this.membersService.updateWorkspace(id, dto, req.user.id);
  }

  @Get()
  findAll(
    @Query('workspaceOwnerId') workspaceOwnerId: string,
    @Query('workspaceId') workspaceId: string,
    @Request() req,
  ) {
    const ownerId = workspaceOwnerId || req.headers['x-workspace-owner-id'];
    const wsId = workspaceId || req.headers['x-workspace-id'];
    return this.membersService.findAll(req.user.id, ownerId, wsId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.membersService.remove(id, req.user.id);
  }
}
